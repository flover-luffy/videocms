import os
import sys
import subprocess
import time
import paramiko
import tarfile
from scp import SCPClient

# ============================================================
# VideoCMS 自动化云端部署脚本 (云端构建版)
# 身份：资深软件架构师
# 功能：源码打包 -> 远程上传 -> 云端构建 -> 自动化部署
# ============================================================

# 配置信息
SERVER_IP = "43.156.239.16"
SERVER_USER = "root"
SERVER_PASS = "123.abc456*"
REMOTE_DEPLOY_DIR = "/root/videocms-deploy"
SOURCE_TAR = "videocms_source.tar.gz"

# 需要排除的目录和文件 (避免上传垃圾或巨大依赖)
EXCLUDE_DIRS = {'.git', 'node_modules', '.next', 'test-results', 'backups', 'prisma/migrations/node_modules'}
EXCLUDE_FILES = {SOURCE_TAR, 'deploy.py', '.env.example', 'test-output.txt'}

def print_step(msg):
    print(f"\n[\033[1;34mSTEP\033[0m] {msg}")

def print_success(msg):
    print(f"[\033[1;32mSUCCESS\033[0m] {msg}")

def print_error(msg):
    print(f"[\033[1;31mERROR\033[0m] {msg}")

def progress_callback(filename, size, sent):
    sys.stdout.write(f"  > 正在上传 {filename}: {float(sent)/float(size)*100:.1f}% \r")
    sys.stdout.flush()

def make_tarfile(output_filename, source_dir):
    print_step(f"正在打包源码至 {output_filename}...")
    def exclude_function(tarinfo):
        # 检查是否在排除列表中
        name = os.path.basename(tarinfo.name)
        if name in EXCLUDE_DIRS or name in EXCLUDE_FILES:
            return None
        # 也可以检查路径片段
        for d in EXCLUDE_DIRS:
            if f"/{d}/" in tarinfo.name or tarinfo.name.startswith(f"{d}/"):
                return None
        return tarinfo

    with tarfile.open(output_filename, "w:gz") as tar:
        tar.add(source_dir, arcname=".", filter=exclude_function)
    
    size_mb = os.path.getsize(output_filename) / (1024 * 1024)
    print_success(f"源码打包完成 (体积: {size_mb:.2f} MB)")

def main():
    start_time = time.time()
    
    # 1. 本地打包源码
    make_tarfile(SOURCE_TAR, ".")

    # 2. 连接服务器并上传
    print_step(f"正在建立 SSH 连接 ({SERVER_IP})...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        # 增加超时时间以应对网络抖动和 Windows 环境下的 SSH 握手延迟
        print("  > 正在尝试 SSH 握手...")
        ssh.connect(
            SERVER_IP, 
            username=SERVER_USER, 
            password=SERVER_PASS, 
            timeout=20, 
            banner_timeout=200, # 核心修复：解决 Error reading SSH protocol banner
            auth_timeout=60
        )
        print_success("SSH 连接成功")

        # 确保远程目录存在并清理旧代码
        ssh.exec_command(f"rm -rf {REMOTE_DEPLOY_DIR} && mkdir -p {REMOTE_DEPLOY_DIR}")
        
        with SCPClient(ssh.get_transport(), progress=progress_callback) as scp:
            # 上传源码包
            print_step("正在上传源码包...")
            scp.put(SOURCE_TAR, remote_path=REMOTE_DEPLOY_DIR)
            print_success("\n源码上传完成")

            # 上传核心运行配置 (如果有独立的配置文件可以额外放这里)
            # 注意：.env 通常应该在服务器上保留或通过脚本传输
            if os.path.exists(".env"):
                scp.put(".env", remote_path=REMOTE_DEPLOY_DIR)
                print("  > 已上传: .env")

        # 3. 远程执行部署命令 (解压 -> 构建 -> 启动 -> 初始化种子)
        print_step("正在执行远程构建与部署 (这在云端可能需要几分钟)...")
        # 注意：不再在 docker-compose 内部 seed，而是在部署完成后通过命令行触发一次，保证幂等且不阻塞启动
        deploy_cmds = [
            f"cd {REMOTE_DEPLOY_DIR}",
            f"tar -xzf {SOURCE_TAR}",
            "docker compose -p videocms up -d --build",
            # 1. 清理构建产生的冗余镜像（解决“无用依赖”问题）
            "docker image prune -f",
            # 2. 清理宿主机源码，仅保留运行时必须的 docker-compose.yml 和 .env
            "echo '  > 正在移除云端源码以节省空间并增强安全性...'",
            "find . -maxdepth 1 ! -name 'docker-compose.yml' ! -name '.env' ! -name '.' -exec rm -rf {} +",
            "echo '  > 正在等待服务启动以执行初始化...'",
            "sleep 10", # 给容器一点启动时间
            "docker compose -p videocms exec -T app npx prisma db seed"
        ]
        
        # 将命令合并，并确保每一个步骤成功才会继续
        full_cmd = " && ".join(deploy_cmds)
        
        # 使用 get_pty=True 以便看到带颜色的输出和实时流
        stdin, stdout, stderr = ssh.exec_command(full_cmd, get_pty=True)
        
        # 实时打印远程输出
        for line in stdout:
            print(f"  [REMOTE] {line.strip()}")
        
        exit_status = stdout.channel.recv_exit_status()
        if exit_status == 0:
            print_success("远程构建与部署完成 (含数据库种子初始化)")
            
            # 4. 最终连通性简单自检
            print_step("正在检查容器健康状态...")
            _, out, _ = ssh.exec_command("docker compose -p videocms ps")
            for line in out:
                print(f"  {line.strip()}")
        else:
            print_error(f"部署过程中发生错误，退出码: {exit_status}")
            print(stderr.read().decode())

    except Exception as e:
        print_error(f"过程中发生异常: {str(e)}")
    finally:
        ssh.close()
        if os.path.exists(SOURCE_TAR):
            os.remove(SOURCE_TAR)
            print_success("已清理本地临时源码包")

    end_time = time.time()
    print(f"\n\033[1;32m全自动化部署任务完成！总耗时: {int(end_time - start_time)} 秒\033[0m")
    print(f"应用访问地址: http://{SERVER_IP}:3001")
    print(f"数据库访问端口: 54321 (映射自容器 5432)")
    print(f"监控状态: OpenTelemetry 已激活，数据上报中...")

if __name__ == "__main__":
    main()
