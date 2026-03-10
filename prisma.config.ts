import { defineConfig } from "@prisma/config";
import { env } from "node:process";

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: "postgresql://rom:123.abc456*@127.0.0.1:5432/videocms",
    },
});
