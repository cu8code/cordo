import { useEffect } from "react";

export default function Page() {
  useEffect(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("tabs/record.html") })
  })

  return null
}
