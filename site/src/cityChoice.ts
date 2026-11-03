// The city picked in one section is the city every section shows, so choosing
// Madrid at the top does not snap back to Barcelona further down.
import { CITIES, CITY_LABELS, type City } from "./data";
import { el, segmented } from "./ui";

let current: City = "barcelona";
const listeners: ((city: City) => void)[] = [];

export function currentCity(): City {
  return current;
}

/** A "City" button row bound to the shared choice. `onChange` runs in every
 *  section's control when any one of them is used. */
export function cityControl(onChange: (city: City) => void): HTMLElement {
  const host = el("div");
  host.append(segmented("City", CITIES.map((c) => ({ value: c, label: CITY_LABELS[c] })), current, (value) => {
    current = value;
    for (const listener of listeners) listener(value);
  }));
  listeners.push((city) => {
    // Update the pressed state in place: replacing the buttons would drop
    // keyboard focus from the one just used.
    host.querySelectorAll("button").forEach((button, index) => button.setAttribute("aria-pressed", String(CITIES[index] === city)));
    onChange(city);
  });
  return host;
}
