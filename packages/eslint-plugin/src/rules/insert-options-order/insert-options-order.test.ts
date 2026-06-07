import { RuleTester } from "@typescript-eslint/rule-tester"
import { ts } from "@/shared/tag"
import rule from "./insert-options-order"

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ["*.ts*"],
      },
      tsconfigRootDir: import.meta.dirname,
    },
  },
})

ruleTester.run("insert-options-order", rule, {
  valid: [
    {
      name: "full",
      code: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot<{ userId: number }>()

        Header.api.insert({
          filter: (props) => props.userId > 0,
          mapProps: (props) => ({ id: props.userId }),
          Component: (props) => null,
          order: 1,
        })
      `,
    },
    {
      name: "without filter",
      code: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot<{ userId: number }>()

        Header.api.insert({
          mapProps: (props) => ({ id: props.userId }),
          Component: (props) => null,
          order: 1,
        })
      `,
    },
    {
      name: "component only",
      code: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot()

        Header.api.insert({
          Component: () => null,
        })
      `,
    },
    {
      name: "destructured insert",
      code: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot()
        const { insert } = Header.api

        insert({
          Component: () => null,
          order: 1,
        })
      `,
    },
    {
      name: "misordered shape twin from another source",
      code: ts`
        declare const db: { insert: (options: { order: number; Component: () => null }) => void }

        db.insert({
          order: 1,
          Component: () => null,
        })
      `,
    },
    {
      name: "misordered shape twin behind same-name import",
      code: ts`
        import { insert } from "some-other-package"

        insert({
          order: 1,
          Component: () => null,
        })
      `,
    },
    {
      name: "unknown option bails",
      code: ts`
        declare const db: { insert: (options: object) => void }

        db.insert({
          order: 1,
          Component: () => null,
          table: "users",
        })
      `,
    },
    {
      name: "spread bails",
      code: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot()
        const base = {}

        Header.api.insert({
          order: 1,
          ...base,
          Component: () => null,
        })
      `,
    },
    {
      name: "no component bails",
      code: ts`
        declare const collection: { insert: (options: object) => void }

        collection.insert({
          order: 1,
          filter: (doc: { active: boolean }) => doc.active,
        })
      `,
    },
    {
      name: "computed Component key bails",
      code: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot()
        const Component = "Component"

        Header.api.insert({
          order: 1,
          [Component]: () => null,
        })
      `,
    },
    {
      name: "duplicate option key bails",
      code: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot()

        Header.api.insert({
          order: 1,
          Component: () => null,
          order: 2,
        })
      `,
    },
    {
      name: "imported slot insert in correct order",
      code: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        declare const Header: ReturnType<typeof createSlot<{ userId: number }>>

        Header.api.insert({
          filter: (props) => props.userId > 0,
          mapProps: (props) => ({ id: props.userId }),
          Component: (props) => null,
          order: 1,
        })
      `,
    },
  ],
  invalid: [
    {
      name: "mapProps after Component",
      code: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot<{ userId: number }>()

        Header.api.insert({
          Component: (props) => null,
          mapProps: (props) => ({ id: props.userId }),
        })
      `,
      output: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot<{ userId: number }>()

        Header.api.insert({
        mapProps: (props) => ({ id: props.userId }),
        Component: (props) => null
        })
      `,
      errors: [
        {
          messageId: "invalidOrder",
          data: {
            correctOrder: "mapProps -> Component",
            currentOrder: "Component -> mapProps",
          },
        },
      ],
    },
    {
      name: "order first",
      code: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot<{ userId: number }>()

        Header.api.insert({
          order: 1,
          filter: (props) => props.userId > 0,
          mapProps: (props) => ({ id: props.userId }),
          Component: (props) => null,
        })
      `,
      output: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot<{ userId: number }>()

        Header.api.insert({
        filter: (props) => props.userId > 0,
        mapProps: (props) => ({ id: props.userId }),
        Component: (props) => null,
        order: 1
        })
      `,
      errors: [
        {
          messageId: "invalidOrder",
          data: {
            correctOrder: "filter -> mapProps -> Component -> order",
            currentOrder: "order -> filter -> mapProps -> Component",
          },
        },
      ],
    },
    {
      name: "filter after mapProps",
      code: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot<{ userId: number }>()

        Header.api.insert({
          mapProps: (props) => ({ id: props.userId }),
          filter: (props) => props.userId > 0,
          Component: (props) => null,
        })
      `,
      output: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot<{ userId: number }>()

        Header.api.insert({
        filter: (props) => props.userId > 0,
        mapProps: (props) => ({ id: props.userId }),
        Component: (props) => null
        })
      `,
      errors: [
        {
          messageId: "invalidOrder",
          data: {
            correctOrder: "filter -> mapProps -> Component",
            currentOrder: "mapProps -> filter -> Component",
          },
        },
      ],
    },
    {
      name: "order before Component",
      code: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot()

        Header.api.insert({
          order: 2,
          Component: () => null,
        })
      `,
      output: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot()

        Header.api.insert({
        Component: () => null,
        order: 2
        })
      `,
      errors: [
        {
          messageId: "invalidOrder",
          data: {
            correctOrder: "Component -> order",
            currentOrder: "order -> Component",
          },
        },
      ],
    },
    {
      name: "destructured insert",
      code: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot<{ userId: number }>()
        const { insert } = Header.api

        insert({
          Component: (props) => null,
          filter: (props) => props.userId > 0,
          mapProps: (props) => ({ id: props.userId }),
        })
      `,
      output: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot<{ userId: number }>()
        const { insert } = Header.api

        insert({
        filter: (props) => props.userId > 0,
        mapProps: (props) => ({ id: props.userId }),
        Component: (props) => null
        })
      `,
      errors: [
        {
          messageId: "invalidOrder",
          data: {
            correctOrder: "filter -> mapProps -> Component",
            currentOrder: "Component -> filter -> mapProps",
          },
        },
      ],
    },
    {
      name: "renamed destructured insert",
      code: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot()
        const { insert: insertWidget } = Header.api

        insertWidget({
          order: 1,
          Component: () => null,
        })
      `,
      output: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot()
        const { insert: insertWidget } = Header.api

        insertWidget({
        Component: () => null,
        order: 1
        })
      `,
      errors: [
        {
          messageId: "invalidOrder",
          data: {
            correctOrder: "Component -> order",
            currentOrder: "order -> Component",
          },
        },
      ],
    },
    {
      name: "multiline option keeps its text",
      code: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot()

        Header.api.insert({
          order: 1,
          Component: () => {
            return null
          },
        })
      `,
      output: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        const Header = createSlot()

        Header.api.insert({
        Component: () => {
            return null
          },
        order: 1
        })
      `,
      errors: [
        {
          messageId: "invalidOrder",
          data: {
            correctOrder: "Component -> order",
            currentOrder: "order -> Component",
          },
        },
      ],
    },
    {
      name: "imported slot insert is reordered without a traceable createSlot call",
      code: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        declare const Header: ReturnType<typeof createSlot<{ userId: number }>>

        Header.api.insert({
          Component: (props) => null,
          mapProps: (props) => ({ id: props.userId }),
        })
      `,
      output: ts`
        import { createSlot } from "@grlt-hub/react-slots"

        declare const Header: ReturnType<typeof createSlot<{ userId: number }>>

        Header.api.insert({
        mapProps: (props) => ({ id: props.userId }),
        Component: (props) => null
        })
      `,
      errors: [
        {
          messageId: "invalidOrder",
          data: {
            correctOrder: "mapProps -> Component",
            currentOrder: "Component -> mapProps",
          },
        },
      ],
    },
  ],
})
