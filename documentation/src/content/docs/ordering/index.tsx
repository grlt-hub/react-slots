import { createSlot } from "@grlt-hub/react-slots"
import { Issues } from "./issues"
import { PullRequests } from "./pull-requests"
import { Stars } from "./stars"

const widgets = createSlot()

widgets.api.insert({
  Component: PullRequests,
  order: 1,
})
widgets.api.insert({
  Component: Issues,
  order: 2,
})
widgets.api.insert({
  Component: Stars,
  order: 0,
})

export default function App() {
  return (
    <>
      <aside>
        <h2>dashboard</h2>
        <widgets.Root />
      </aside>
    </>
  )
}
