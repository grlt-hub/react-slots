import { Widget } from "./_widget"

type Props = {
  value: number
}

const Issues = (props: Props) => <Widget accent={["#56d364", "#3fb950"]} title="Issues" value={props.value} />

export { Issues }
