build:
	npx rslib build

lint:
	npx size-limit

prepublish:
	make build && make lint && make test

publish:
	npm i && make prepublish && npx clean-publish

test:
	npx vitest
