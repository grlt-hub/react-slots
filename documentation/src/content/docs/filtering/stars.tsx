import { Widget } from "./_widget"

type Props = {
  value: number
}

const Stars = (props: Props) => <Widget accent={["#f5d77b", "#e3b341"]} title="Stars" value={props.value} />

export { Stars }
