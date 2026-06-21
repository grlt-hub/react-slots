import { createSlot } from "@grlt-hub/react-slots"
import { Issues } from "./issues"
import { PullRequests } from "./pull-requests"
import { Stars } from "./stars"

const widgets = createSlot()

widgets.api.insert({ Component: Issues })
widgets.api.insert({ Component: PullRequests })
widgets.api.insert({ Component: Stars })

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
