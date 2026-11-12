#!/usr/bin/env python3
# v5.30.16 — add chat.actions.* keys to all four locales (en/fr/sw/yo).
# Appends via json round-trip (order-preserving; no trailing-comma traps).
# Yoruba diacritics are built from \u escapes in THIS source so nothing
# non-ASCII ever travels through the shell channel (v5.30.15 mojibake lesson).
import json, collections, sys

ROOT = '/home/z/my-project/kivora/lib/i18n'

# Yoruba builds (escape-checked): ọ=U+1ECD ẹ=U+1EB9 ṣ=U+1E63, combining graves=U+0300 acutes=U+0301
YO = {
    "copy":        "Daak\u1ECD",                                       # Daakọ
    "quote":       "Dahun p\u1EB9\u0300l\u00FA \u1ECD\u0300r\u1ECD\u0300",  # Dahun pẹ̀lú ọ̀rọ̀ (reply with words)
    "save":        "Fi pam\u1ECD\u0301",                               # Fi pamọ́ (keep/save)
    "saved":       "Ti fi pam\u1ECD\u0301",                            # Ti fi pamọ́ (has been saved)
    "save_failed": "K\u00F2 t\u00ED\u00ED fi pam\u1ECD\u0301",          # Kò tíì fi pamọ́ (could not save)
    "signin_save": "W\u1ECDl\u00E9 k\u00ED o l\u00E8 fi pam\u1ECD\u0301",  # Wọlé kí o lè fi pamọ́ (sign in so you can save)
    "up":          "O d\u00E1ra",                                      # O dára (it is good)
    "down":        "K\u00F2 d\u00E1ra",                                # Kò dára (it is not good)
    "rerun":       "T\u00FAn \u1E63e",                                 # Tún ṣe (do again)
}

KEYS = {
    "en": {
        "chat.actions.copy": "Copy",
        "chat.actions.quote": "Quote reply",
        "chat.actions.save": "Save to workspace",
        "chat.actions.saved": "Saved to workspace",
        "chat.actions.save_failed": "Couldn't save to workspace",
        "chat.actions.signin_save": "Sign in to save to your workspace",
        "chat.actions.up": "Good response",
        "chat.actions.down": "Bad response",
        "chat.actions.rerun": "Regenerate",
    },
    "fr": {
        "chat.actions.copy": "Copier",
        "chat.actions.quote": "Citer et r\u00E9pondre",
        "chat.actions.save": "Enregistrer dans l'espace de travail",
        "chat.actions.saved": "Enregistr\u00E9 dans l'espace de travail",
        "chat.actions.save_failed": "\u00C9chec de l'enregistrement",
        "chat.actions.signin_save": "Connectez-vous pour enregistrer dans votre espace de travail",
        "chat.actions.up": "Bonne r\u00E9ponse",
        "chat.actions.down": "Mauvaise r\u00E9ponse",
        "chat.actions.rerun": "R\u00E9g\u00E9n\u00E9rer",
    },
    "sw": {
        "chat.actions.copy": "Nakili",
        "chat.actions.quote": "Jibu kwa kunukuu",
        "chat.actions.save": "Hifadhi kwenye nafasi ya kazi",
        "chat.actions.saved": "Imehifadhiwa kwenye nafasi ya kazi",
        "chat.actions.save_failed": "Imeshindikana kuhifadhi",
        "chat.actions.signin_save": "Ingia ili uhifadhi kwenye nafasi yako ya kazi",
        "chat.actions.up": "Jibu zuri",
        "chat.actions.down": "Jibu baya",
        "chat.actions.rerun": "Zalisha upya",
    },
    "yo": {
        f"chat.actions.{k}": v for k, v in YO.items()
    },
}

fail = 0
for loc, add in KEYS.items():
    path = f"{ROOT}/{loc}.json"
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh, object_pairs_hook=collections.OrderedDict)
    added = 0
    for k, v in add.items():
        if k in data:
            if data[k] != v:
                print(f"  WARN {loc}:{k} exists with different value — overwriting")
                data[k] = v
        else:
            data[k] = v
            added += 1
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"  {loc}.json: +{added} keys (total {len(data)})")

# verify: every locale carries every key
for loc in KEYS:
    with open(f"{ROOT}/{loc}.json", encoding="utf-8") as fh:
        data = json.load(fh)
    missing = [k for k in KEYS["en"] if k not in data]
    if missing:
        print(f"  FAIL {loc} missing: {missing}")
        fail = 1
sys.exit(fail)
