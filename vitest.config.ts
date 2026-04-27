import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const TEST_JWT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC8s5ZTnFJ3gXY7
YPJkskVWFn68sRIYkmrq/IEeBGuE2OtUZQsmQhAAFzWbwsfGMRGPFoUDYzz/L69h
vIifX44Y7Ea7ldROLXuGNx2rvUmNuFpdMM0ycX0lovTrEE7L4AThNNfJGrYfRjss
mnJgsBB+3O603F/Y2qGXNPClpB21VrwQDJvxjroz9BfRRc4NQSfA0+Un+rBR1Mkq
9Oisn8qbpugR48ddqYPZVpYERgyLE65FlskIRCPFfdIk3JmoM9Rn+L6fX3SknO87
KGPy31lyhmYbh9coPpenT9wjgEzH4QYw+AW3AzKMvovksvQDbnpVyq4wz84FI8vl
7cvcJo6tAgMBAAECggEAR4yqr8pCpKiUfYBNeGv2CWXfKUnUrDd8TdxvUsPnRsh/
NpFXkGqVKYujWouY9yes2j32Mmoi+zmH/P2hKhjvxrh0O3VcukXZo/LrD67moFNq
BBLYg0tv4eDvj9+vmPM4tnG0bj7wFlypXEi1nL61inzYEADNYOrJQY2jv5LCZvq0
Ekr1qzeS6Hg3YzRg9sZLCzpjfUK9WbzF9OA2we88kbL6zkGFEyX2ebmJJUTsqBKn
pkxn6AFGZT+Q0urdU31mlEo8G8UYNSNZrasZYO9NvgpywYxrPd/8J5cgNbvLqsn+
1s21E8E5WdzqE6j/+LF0nIMx1UyvewV3VW9xyo50KwKBgQD0rH5nnS+vc1rg2bUb
os3thakBPNbeVNf1nwjU8ZZfE3NRkjnV+0bBp4pXYJG/PNcjWGfBnPxsllIHwaUQ
ZDiBuRD3qPN/U11a+D8DvNI7yUzsCly4djZfEueveZq5QNXerIVOqvdFrH8RKkoX
yVLrmxCH5I2WCik0dizYLdDnbwKBgQDFb8tBK1IDiQsoEOUoAwPj6QkPt0w9NOvP
gbNo0Y/tpa4kATlMF4P18ItzlBH9QksSRl9zlgV23QXuDvhh30RRNUQmuuelAB09
QBYE5hsOzU4s+NFcTwxI7E+oYHwLHhxWOUDRhLtLo2Axr6NX7S2WjIju7LJrk28Q
AIe/Yf59owKBgQCCOUC54xZbOnlXDWhwQhF6ZtZRu1DdWqjqqO9pbv/KsK6C7uHr
eubo8UQXR2WrNDWJMWdfzC8pmEQmrrEs7TqKCLb4KasXzIX2ggP/+EKo4XYYd1ds
Mja0GXrIkV+BU/nAn3AAM8yR/8JNn4V57YQ9s/VzbnjRL61Ip9Esag4y7wKBgGy0
5QB4zatMpWvmAYZKQrYV9PtGPR/mJ4AVNacc21ZJxtvkIJwYxnt/egilGlKLUbI6
NQv7Kf8MKtusOm4I9CCSZ3e7qRdcPL0gr/76gyNfPw/b38ona+gq1KEsnp+wcIG4
/Etf/Y/j4G76+cDLwjIGJs8GXCaHAruYzyU821ZpAoGBAMw3zPQl6gFrAnYWfWYo
ZQPgg7WkkAAdmuClzfF9J4fuPpaJ7Fdb0oMtvdcj1LJykKKWPYlnUC4m+bq7jvEn
mHxX6Fe4o9a9Q9vv+9gPVdTmBsNOnQiVrg/vjkmW7U0bNJbRswn6jDxD4AfFYBDr
666uYKMvENtkmlafOfnzm+tC
-----END PRIVATE KEY-----`;

const TEST_JWT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvLOWU5xSd4F2O2DyZLJF
VhZ+vLESGJJq6vyBHgRrhNjrVGULJkIQABc1m8LHxjERjxaFA2M8/y+vYbyIn1+O
GOxGu5XUTi17hjcdq71JjbhaXTDNMnF9JaL06xBOy+AE4TTXyRq2H0Y7LJpyYLAQ
ftzutNxf2NqhlzTwpaQdtVa8EAyb8Y66M/QX0UXODUEnwNPlJ/qwUdTJKvTorJ/K
m6boEePHXamD2VaWBEYMixOuRZbJCEQjxX3SJNyZqDPUZ/i+n190pJzvOyhj8t9Z
coZmG4fXKD6Xp0/cI4BMx+EGMPgFtwMyjL6L5LL0A256VcquMM/OBSPL5e3L3CaO
rQIDAQAB
-----END PUBLIC KEY-----`;

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
    env: {
      JWT_PRIVATE_KEY: TEST_JWT_PRIVATE_KEY,
      JWT_PUBLIC_KEY: TEST_JWT_PUBLIC_KEY,
      ENCRYPTION_SECRET: "test-encryption-secret-at-least-32-bytes",
      ENCRYPTION_SALT: "test-encryption-salt",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      NODE_ENV: "test",
    },
  },
});
