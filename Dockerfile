FROM rust:1.92.0

WORKDIR /app

# Install required system dependencies
RUN apt update && apt install lld clang -y

# Copy all files fom our working environment
COPY . .

# Set SQLX to offline mode to make use of local query file.
ENV SQLX_OFFLINE=true

# Build the binary
RUN cargo build --release

# Set the running environment to production
ENV APP_ENVIRONMENT="production"

ENTRYPOINT ["./target/release/zero2prod"]
