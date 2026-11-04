// The city picked in one section is the city every section shows, so choosing
// Madrid at the top does not snap back to Barcelona further down.
import { CITIES, CITY_LABELS, type City } from "./data";
import { selectControl } from "./ui";

let current: City = "barcelona";
const listeners: ((city: City) => void)[] = [];

export function currentCity(): City {
  return current;
}

/** A "City" drop-down bound to the shared choice. `onChange` runs in every
 *  section's control when any one of them is used. */
export function cityControl(onChange: (city: City) => void): HTMLElement {
  const { element, select } = selectControl("City", CITIES.map((c) => ({ value: c, label: CITY_LABELS[c] })), current, (value) => {
    current = value;
    for (const listener of listeners) listener(value);
  });
  listeners.push((city) => {
    select.value = city; // set in place, so keyboard focus stays on the control just used
    onChange(city);
  });
  return element;
}
