import os
import shlex
import sys
import tarfile
import time

import paramiko
from dotenv import load_dotenv
from scp import SCPClient

load_dotenv()

ENV_FILE = ".env"
REMOTE_DEPLOY_DIR = "/root/videocms-deploy"
SOURCE_TAR = "videocms_source.tar.gz"
COMPOSE_PROJECT = "videocms"
APP_SERVICE = "app"
APP_CONTAINER = "videocms_app"
HEALTH_TIMEOUT_SECONDS = 180
HEALTH_POLL_INTERVAL_SECONDS = 5

REQUIRED_ENV_VARS = (
    "DEPLOY_SERVER_IP",
    "DEPLOY_SERVER_USER",
    "DEPLOY_SERVER_PASS",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",
    "DATABASE_URL",
    "REDIS_URL",
)

EXCLUDE_DIRS = {
    ".git",
    ".next",
    ".gemini",
    ".vscode",
    "backups",
    "node_modules",
    "prisma/migrations/node_modules",
    "test-results",
}
EXCLUDE_FILES = {
    ENV_FILE,
    SOURCE_TAR,
    ".DS_Store",
    ".env.example",
    "deploy.py",
    "test-output.txt",
    "test_connection.py",
}
EXCLUDE_SUFFIXES = (".tsbuildinfo",)


class DeploymentError(RuntimeError):
    """Raised when the deployment flow cannot continue safely."""


def print_step(message):
    print(f"\n[\033[1;34mSTEP\033[0m] {message}")


def print_success(message):
    print(f"[\033[1;32mSUCCESS\033[0m] {message}")


def print_error(message):
    print(f"[\033[1;31mERROR\033[0m] {message}")


def progress_callback(filename, size, sent):
    if size <= 0:
        return
    percentage = float(sent) / float(size) * 100
    sys.stdout.write(f"  > Uploading {filename}: {percentage:.1f}%\r")
    sys.stdout.flush()


def validate_environment(env=None, env_file_path=ENV_FILE):
    env = os.environ if env is None else env
    if not os.path.exists(env_file_path):
        raise DeploymentError(f"Missing required file: {env_file_path}")

    missing_vars = []
    for name in REQUIRED_ENV_VARS:
        value = env.get(name, "")
        if not str(value).strip():
            missing_vars.append(name)

    if missing_vars:
        raise DeploymentError(
            "Missing required environment variables: " + ", ".join(missing_vars)
        )

    return {
        "server_ip": env["DEPLOY_SERVER_IP"].strip(),
        "server_user": env["DEPLOY_SERVER_USER"].strip(),
        "server_pass": env["DEPLOY_SERVER_PASS"].strip(),
    }


def should_exclude_tarinfo(tarinfo):
    normalized_name = tarinfo.name.replace("\\", "/")
    parts = [part for part in normalized_name.split("/") if part not in ("", ".")]
    if not parts:
        return False

    basename = parts[-1]
    if basename in EXCLUDE_FILES or basename in EXCLUDE_DIRS:
        return True
    if basename.endswith(EXCLUDE_SUFFIXES):
        return True
    if any(part in EXCLUDE_DIRS for part in parts):
        return True
    return False


def make_tarfile(output_filename, source_dir):
    print_step(f"Packing source into {output_filename}...")

    def exclude_function(tarinfo):
        if should_exclude_tarinfo(tarinfo):
            return None
        return tarinfo

    with tarfile.open(output_filename, "w:gz") as tar:
        tar.add(source_dir, arcname=".", filter=exclude_function)

    size_mb = os.path.getsize(output_filename) / (1024 * 1024)
    print_success(f"Source package created ({size_mb:.2f} MB)")


def run_remote_command(ssh, command, *, description=None, stream=False, check=True):
    if description:
        print_step(description)

    stdin, stdout, stderr = ssh.exec_command(command, get_pty=stream)
    del stdin

    if stream:
        output_chunks = []
        for line in iter(stdout.readline, ""):
            if not line:
                break
            print(line, end="")
            output_chunks.append(line)
        exit_status = stdout.channel.recv_exit_status()
        output_text = "".join(output_chunks)
        error_text = ""
    else:
        output_text = stdout.read().decode("utf-8", errors="replace")
        error_text = stderr.read().decode("utf-8", errors="replace")
        exit_status = stdout.channel.recv_exit_status()

        if output_text:
            print(output_text, end="" if output_text.endswith("\n") else "\n")
        if error_text:
            print(error_text, end="" if error_text.endswith("\n") else "\n")

    if check and exit_status != 0:
        raise DeploymentError(
            f"Remote command failed with exit code {exit_status}: {command}"
        )

    return exit_status, output_text, error_text


def capture_remote_command(ssh, command, *, check=True):
    stdin, stdout, stderr = ssh.exec_command(command)
    del stdin

    output_text = stdout.read().decode("utf-8", errors="replace")
    error_text = stderr.read().decode("utf-8", errors="replace")
    exit_status = stdout.channel.recv_exit_status()

    if check and exit_status != 0:
        raise DeploymentError(
            f"Remote command failed with exit code {exit_status}: {command}"
        )

    return exit_status, output_text, error_text


def cd_remote(command):
    return f"cd {shlex.quote(REMOTE_DEPLOY_DIR)} && {command}"


def wait_for_app_health(ssh):
    print_step(
        f"Waiting for {APP_CONTAINER} to become healthy "
        f"(timeout: {HEALTH_TIMEOUT_SECONDS}s)..."
    )
    deadline = time.time() + HEALTH_TIMEOUT_SECONDS
    last_status = None
    inspect_command = (
        "docker inspect --format "
        "'{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "
        f"{shlex.quote(APP_CONTAINER)}"
    )

    while time.time() < deadline:
        exit_status, output_text, _ = capture_remote_command(
            ssh, inspect_command, check=False
        )
        status = output_text.strip() if exit_status == 0 else "missing"

        if status != last_status:
            print(f"  > Container status: {status}")
            last_status = status

        if status == "healthy":
            print_success(f"{APP_CONTAINER} is healthy")
            return

        if status in {"dead", "exited", "unhealthy"}:
            raise DeploymentError(f"{APP_CONTAINER} became {status}")

        time.sleep(HEALTH_POLL_INTERVAL_SECONDS)

    final_status = last_status or "unknown"
    raise DeploymentError(
        f"Timed out after {HEALTH_TIMEOUT_SECONDS}s waiting for {APP_CONTAINER} "
        f"(last status: {final_status})"
    )


def dump_remote_diagnostics(ssh):
    try:
        print_step("Remote container status")
        _, output_text, error_text = capture_remote_command(
            ssh, cd_remote(f"docker compose -p {COMPOSE_PROJECT} ps"), check=False
        )
        if output_text:
            print(output_text, end="" if output_text.endswith("\n") else "\n")
        if error_text:
            print(error_text, end="" if error_text.endswith("\n") else "\n")

        print_step("Recent app logs")
        _, output_text, error_text = capture_remote_command(
            ssh,
            cd_remote(f"docker compose -p {COMPOSE_PROJECT} logs --tail=100 {APP_SERVICE}"),
            check=False,
        )
        if output_text:
            print(output_text, end="" if output_text.endswith("\n") else "\n")
        if error_text:
            print(error_text, end="" if error_text.endswith("\n") else "\n")
    except Exception as exc:  # pragma: no cover - defensive diagnostics path
        print_error(f"Unable to collect remote diagnostics: {exc}")


def main():
    start_time = time.time()
    ssh = None
    server_ip = None
    stack_started = False
    deployment_succeeded = False

    try:
        config = validate_environment()
        server_ip = config["server_ip"]

        make_tarfile(SOURCE_TAR, ".")

        print_step(f"Connecting to {server_ip} via SSH...")
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(
            server_ip,
            username=config["server_user"],
            password=config["server_pass"],
            timeout=30,
            banner_timeout=60,
            auth_timeout=60,
        )
        print_success("SSH connection established")

        run_remote_command(
            ssh,
            f"rm -rf {shlex.quote(REMOTE_DEPLOY_DIR)} && mkdir -p {shlex.quote(REMOTE_DEPLOY_DIR)}",
            description="Preparing remote deployment directory...",
        )

        with SCPClient(ssh.get_transport(), progress=progress_callback) as scp:
            print_step("Uploading deployment bundle...")
            scp.put(SOURCE_TAR, remote_path=REMOTE_DEPLOY_DIR)
            scp.put(ENV_FILE, remote_path=REMOTE_DEPLOY_DIR)
            print("\n  > Synced .env")
            print_success("Upload completed")

        run_remote_command(
            ssh,
            cd_remote(f"tar -xzf {shlex.quote(SOURCE_TAR)}"),
            description="Extracting uploaded source...",
        )
        run_remote_command(
            ssh,
            cd_remote(
                f"docker compose -p {COMPOSE_PROJECT} stop {APP_SERVICE} 2>/dev/null || true"
            ),
            description="Stopping previous app container...",
        )
        run_remote_command(
            ssh,
            cd_remote(
                "export DOCKER_BUILDKIT=1 && "
                f"docker compose -p {COMPOSE_PROJECT} build --no-cache --progress=plain {APP_SERVICE}"
            ),
            description="Building app image...",
            stream=True,
        )
        run_remote_command(
            ssh,
            cd_remote(f"docker compose -p {COMPOSE_PROJECT} up -d"),
            description="Starting compose stack...",
        )
        stack_started = True

        run_remote_command(
            ssh,
            cd_remote("docker image prune -f"),
            description="Pruning dangling images...",
        )
        run_remote_command(
            ssh,
            cd_remote(
                "find . -maxdepth 1 "
                "! -name 'docker-compose.yml' "
                "! -name '.env' "
                "! -name '.' "
                "-exec rm -rf {} +"
            ),
            description="Cleaning remote source directory...",
        )

        wait_for_app_health(ssh)

        run_remote_command(
            ssh,
            cd_remote(
                f"docker compose -p {COMPOSE_PROJECT} exec -T {APP_SERVICE} npx prisma db seed"
            ),
            description="Running database seed...",
            stream=True,
        )
        print_success("Remote deployment completed")

        run_remote_command(
            ssh,
            cd_remote(f"docker compose -p {COMPOSE_PROJECT} ps"),
            description="Current container status",
        )

        deployment_succeeded = True
        return 0
    except DeploymentError as exc:
        print_error(str(exc))
        if ssh is not None and stack_started:
            dump_remote_diagnostics(ssh)
        return 1
    except Exception as exc:  # pragma: no cover - top-level safety net
        print_error(f"Unexpected error: {exc}")
        if ssh is not None and stack_started:
            dump_remote_diagnostics(ssh)
        return 1
    finally:
        if ssh is not None:
            ssh.close()
        if os.path.exists(SOURCE_TAR):
            os.remove(SOURCE_TAR)
            print_success("Removed local temporary source archive")

        elapsed_seconds = int(time.time() - start_time)
        print(f"\n\033[1;32mFinished in {elapsed_seconds}s\033[0m")
        if deployment_succeeded and server_ip:
            print(f"App URL: http://{server_ip}:3001")


if __name__ == "__main__":
    raise SystemExit(main())
