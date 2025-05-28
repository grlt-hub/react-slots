build:
	rm -rf ./dist && npx tsup src/index.tsx --minify --format esm --dts

lint:
	npx size-limit

prepublish:
	make build && make lint

publish:
	npm i && make prepublish && npx clean-publish

test:
	npx vitest
