import { iconUrl } from "../weatherCodes.js";

// The drop that marks rain in the small type under a day or an hour, sized and set on the
// line like the letters beside it. The reading next to it says what it is, so it is not read out.
export default function Drop() {
  return <img src={iconUrl("raindrop")} alt="" className="mr-0.5 inline h-3.5 align-[-0.2em]" />;
}
