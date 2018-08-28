#!/usr/bin/env python3
import json
import requests
import copy
import time
import sys

default_category = "Category:Mandarin_idioms"
default_output = "成语.lst"

batch_size = 500
url = "https://en.wiktionary.org/w/api.php?action=query&list=categorymembers&cmtitle={title}&cmprop=title&cmtype=page&format=json&cmlimit={batch_size}"
continue_url = url + "&continue={cval}&cmcontinue={ctoken}"
base_args = {
  "action": "query",
  "list": "categorymembers",
  "cmprop": "title",
  "cmtype": "page",
  "format": "json",
  "cmlimit": batch_size
}

if __name__ == "__main__":
  category = default_category
  output = default_output

  keep_going = True
  u = url.format(title=category, batch_size=batch_size)
  args = copy.copy(base_args)
  args["cmtitle"] = category
  all_categories = []
  while keep_going:
    r = requests.get(u, params=args)
    if r.status_code == 200:
      keep_going = True
      response = r.json()
      cms = response["query"]["categorymembers"]
      if len(cms) < batch_size:
        keep_going = False
      all_categories.extend(cms)
      if "continue" in response:
        cval = response["continue"].get("continue", None)
        ctoken = response["continue"].get("cmcontinue", None)
        if cval == "-||" and ctoken:
          args["continue"] = cval
          args["cmcontinue"] = ctoken
          # keep looping
        else:
          keep_going = False
    else:
      print("Error: {}".format(r.status_code))
      print(r)
    print('.', end='')
    sys.stdout.flush()
    time.sleep(0.25)
  print()

  print("Found {} categories.".format(len(all_categories)))
  with open(output, 'w') as fout:
    for c in all_categories:
      fout.write(c["title"] + '\n')
