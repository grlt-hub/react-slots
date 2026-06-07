import { AST_NODE_TYPES as NodeType, ESLintUtils, type TSESTree as Node } from "@typescript-eslint/utils"
import { PACKAGE_NAME, UNITS } from "@/shared/constants"
import { createRule } from "@/shared/create"

const TRUE_ORDER = ["filter", "mapProps", "Component", "order"]
const REQUIRED = "Component"
const INSERT_TYPES = new Set(["InsertWithProps", "InsertWithoutProps"])

const argumentSelector = `ObjectExpression.arguments`

export default createRule({
  name: "insert-options-order",
  meta: {
    type: "problem",
    docs: {
      description: `Enforce options order for ${UNITS.INSERT}`,
    },
    messages: {
      invalidOrder: `Order of options should be \`{{ correctOrder }}\`, but found \`{{ currentOrder }}\`.`,
    },
    schema: [],
    hasSuggestions: false,
    fixable: "code",
  },
  defaultOptions: [],
  create: (context) => {
    const source = context.sourceCode
    const services = ESLintUtils.getParserServices(context)

    const isSlotInsert = (callee: Node.Expression) => {
      const alias = services.getTypeAtLocation(callee).aliasSymbol
      if (!alias || !INSERT_TYPES.has(alias.name)) return false

      const declarations = alias.getDeclarations() ?? []
      return declarations.some((declaration) =>
        declaration.getSourceFile().fileName.includes(`/${PACKAGE_NAME.UNSCOPED}/`),
      )
    }

    return {
      [`CallExpression[arguments.length=1] > ${argumentSelector}`]: (node: Node.ObjectExpression) => {
        let hasRequired = false

        for (const prop of node.properties) {
          if (prop.type === NodeType.SpreadElement || prop.computed || prop.key.type !== NodeType.Identifier) return
          if (prop.key.name === REQUIRED) hasRequired = true
        }

        if (!hasRequired) return

        const properties = node.properties as (Node.Property & { key: Node.Identifier })[]
        const current = properties.map((prop) => prop.key.name)

        if (new Set(current).size !== current.length) return
        if (current.some((key) => !TRUE_ORDER.includes(key))) return
        if (isCorrectOrder(current)) return
        if (!isSlotInsert((node.parent as Node.CallExpression).callee)) return

        const correctOrder = TRUE_ORDER.filter((item) => current.includes(item))
        const snippets = properties
          .toSorted((a, b) => TRUE_ORDER.indexOf(a.key.name) - TRUE_ORDER.indexOf(b.key.name))
          .map((prop) => source.getText(prop))

        const data = { correctOrder: correctOrder.join(" -> "), currentOrder: current.join(" -> ") }
        context.report({
          node,
          messageId: "invalidOrder",
          data,
          fix: (fixer) => [fixer.replaceText(node, `{\n${snippets.join(",\n")}\n}`)],
        })
      },
    }
  },
})

const isCorrectOrder = (current: string[]) => {
  let seen = -1

  for (const item of current) {
    const index = TRUE_ORDER.indexOf(item)
    if (index <= seen) return false
    seen = index
  }

  return true
}
