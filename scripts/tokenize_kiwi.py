#!/usr/bin/env python3
import json
import re
import sys

from kiwipiepy import Kiwi


ALLOWED_TAGS = {"NNG", "NNP", "SL", "SN"}
RAW_PATTERN = re.compile(r"[$#@]?[A-Za-z][A-Za-z0-9._+-]{1,9}|[0-9]+(?:\.[0-9]+)+")
BLOCKED_FORMS = {
    "그냥", "진짜", "근데", "오늘", "지금", "이번", "다음", "요즘", "갑자기",
    "님들", "어떻게", "있는", "없는", "있음", "있다", "된다", "하는", "하면",
    "해서", "하고", "있는데", "없는데", "하는데", "되는데", "쓰는데", "같은데",
    "하냐", "되냐", "있냐", "없냐", "같냐", "후기", "근황", "관련", "질문", "정보", "뉴스", "주식",
    "주가", "종목", "시장", "사람", "생각", "이유", "정도", "얘기", "이야기",
    "소리", "새끼", "병신", "씨발", "시발",
}


def unique(items):
    seen = set()
    out = []
    for item in items:
        item = str(item or "").strip()
        if not item or item in seen:
            continue
        if item in BLOCKED_FORMS or item.lower() in BLOCKED_FORMS:
            continue
        if re.fullmatch(r"[가-힣]", item):
            continue
        seen.add(item)
        out.append(item)
    return out


def tokenize_title(kiwi, title):
    raw_tokens = RAW_PATTERN.findall(title or "")
    morph_tokens = [
        token.form
        for token in kiwi.tokenize(title or "")
        if token.tag in ALLOWED_TAGS and len(token.form.strip()) >= 2
    ]
    return unique(raw_tokens + morph_tokens)


def main():
    titles = json.load(sys.stdin)
    if not isinstance(titles, list):
        raise ValueError("expected JSON list")

    kiwi = Kiwi()
    result = [tokenize_title(kiwi, str(title)) for title in titles]
    json.dump(result, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
