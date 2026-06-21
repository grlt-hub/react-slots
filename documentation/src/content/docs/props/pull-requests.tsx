import { Widget } from "./_widget"

type Props = {
  value: number
}

const PullRequests = (props: Props) => <Widget accent={["#c297ff", "#8957e5"]} title="Pull requests" value={props.value} />

export { PullRequests }
