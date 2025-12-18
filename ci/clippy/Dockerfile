FROM rust:1.92.0

RUN rustup component add clippy rustfmt

WORKDIR /work
COPY ci/clippy/run.sh /usr/local/bin/ci-clippy
RUN chmod +x /usr/local/bin/ci-clippy

ENV SQLX_OFFLINE=true

ENTRYPOINT ["/usr/local/bin/ci-clippy"]
