import { createSlot } from "@grlt-hub/react-slots"
import { useEffect, useState } from "react"
import { Stars } from "./stars"

const widgets = createSlot<{ stars: number }>()

widgets.api.insert({
  filter: (props) => props.stars % 2 === 0,
  mapProps: (props) => props,
  Component: (props) => <Stars value={props.stars} />,
})

export default function App() {
  const [stars, setStars] = useState(10)

  useEffect(() => {
    const id = setInterval(() => setStars((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      <aside>
        <h2>dashboard</h2>
        <widgets.Root stars={stars} />
      </aside>
    </>
  )
}
