FROM lukemathwalker/cargo-chef:latest-rust-1.92.0 as chef
WORKDIR /app
RUN apt update && apt install lld clang -y

FROM chef as planner
# Compute lock-like file for our project
COPY Cargo.toml Cargo.toml
RUN cargo chef prepare --recipe-path recipe.json

FROM chef as builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
# Up to this point, if our dependency tree stays the same, all layers are cached 

COPY . .
ENV SQLX_OFFLINE=true

RUN cargo build --release --bin zero2prod

FROM debian:bookworm-slim as runtime
WORKDIR /app
RUN apt-get update -y \
&& apt-get install -y --no-install-recommends openssl ca-certificates libc6 \
&& apt-get autoremove -y \
&& apt-get clean -y \
&& rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/zero2prod zero2prod
COPY configuration configuration
ENV APP_ENVIRONMENT=production

ENTRYPOINT ["./zero2prod"]
