import { createSlot } from "@grlt-hub/react-slots"
import { Issues } from "./issues"
import { PullRequests } from "./pull-requests"
import { Stars } from "./stars"

const widgets = createSlot<{ stars: number; issues: number; prs: number }>()

widgets.api.insert({
  mapProps: (props) => ({ value: props.issues }),
  Component: Issues,
})
widgets.api.insert({
  mapProps: (props) => ({ value: props.prs }),
  Component: PullRequests,
})
widgets.api.insert({
  mapProps: (props) => ({ value: props.stars }),
  Component: Stars,
})

export default function App() {
  return (
    <aside>
      <h2>dashboard</h2>
      <widgets.Root stars={1240} issues={24} prs={5} />
    </aside>
  )
}
