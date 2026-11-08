.PHONY: setup build up init test status stop lint

setup:
	bash src/artex/artex.sh setup

build:
	bash src/artex/artex.sh build

up:
	bash src/artex/artex.sh up

init:
	node tests/artex/ui-smoke.cjs --initialize

test:
	bash tests/artex/check-runtime.sh
	node tests/artex/ui-smoke.cjs

status:
	bash src/artex/artex.sh status

stop:
	bash src/artex/artex.sh stop

lint:
	bash -n src/artex/artex.sh
	bash -n tests/artex/check-runtime.sh
	node --check tests/artex/ui-smoke.cjs
	git diff --check
