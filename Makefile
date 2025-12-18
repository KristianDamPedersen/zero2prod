CI_CLIPPY_IMAGE := ci-clippy:local

.PHONY: ci-clippy-build ci-clippy

ci-clippy-build:
	docker build -f ci/clippy/Dockerfile -t $(CI_CLIPPY_IMAGE) .

ci-clippy: ci-clippy-build
	ci/_lib/run-job.sh $(CI_CLIPPY_IMAGE)
