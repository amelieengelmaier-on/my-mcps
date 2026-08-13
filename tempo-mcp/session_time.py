from datetime import datetime, timedelta
import json
import sys
from typing import Optional


def _parse(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def calculate_time(
    timestamps: list[str],
    gap_threshold_minutes: int = 60,
    meetings: Optional[list[dict]] = None,
) -> dict:
    points = sorted({_parse(value) for value in timestamps})
    by_day: dict[str, int] = {}
    active_intervals = []
    threshold = timedelta(minutes=gap_threshold_minutes)

    for start, end in zip(points, points[1:]):
        if end - start > threshold:
            continue
        active_intervals.append((start, end))
        cursor = start
        while cursor.date() < end.date():
            boundary = datetime.combine(
                cursor.date() + timedelta(days=1),
                datetime.min.time(),
                tzinfo=cursor.tzinfo,
            )
            seconds = int((boundary - cursor).total_seconds())
            by_day[str(cursor.date())] = by_day.get(str(cursor.date()), 0) + seconds
            cursor = boundary
        seconds = int((end - cursor).total_seconds())
        by_day[str(cursor.date())] = by_day.get(str(cursor.date()), 0) + seconds

    for event in eligible_meetings(meetings or []):
        meeting_start = _parse(event["start"]["dateTime"])
        meeting_end = _parse(event["end"]["dateTime"])
        for active_start, active_end in active_intervals:
            start = max(meeting_start, active_start)
            end = min(meeting_end, active_end)
            if start >= end:
                continue
            cursor = start
            while cursor < end:
                day_end = datetime.combine(
                    cursor.date() + timedelta(days=1),
                    datetime.min.time(),
                    tzinfo=cursor.tzinfo,
                )
                overlap = min(end, day_end) - cursor
                by_day[str(cursor.date())] = max(
                    0,
                    by_day.get(str(cursor.date()), 0) - int(overlap.total_seconds()),
                )
                cursor = day_end

    return {"total_seconds": sum(by_day.values()), "by_day": by_day}


def eligible_meetings(events: list[dict]) -> list[dict]:
    result = []
    for event in events:
        if event.get("eventType") == "FOCUS_TIME":
            continue
        if event.get("allDay") or event.get("transparency") == "transparent":
            continue
        attendees = event.get("attendees", [])
        self_attendee = next((item for item in attendees if item.get("self")), None)
        if not self_attendee or self_attendee.get("responseStatus") != "accepted":
            continue
        if len([item for item in attendees if not item.get("self")]) == 0:
            continue
        result.append(event)
    return result


def allocate_eligible_time(seconds: int, available_by_day: dict[str, int]) -> dict[str, int]:
    remaining = max(0, seconds)
    allocated = {}
    for date, available in sorted(available_by_day.items()):
        amount = min(remaining, max(0, available))
        if amount:
            allocated[date] = amount
        remaining -= amount
    return allocated


def _main() -> None:
    payload = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else json.load(sys.stdin)
    result = calculate_time(
        payload.get("timestamps", []),
        payload.get("gap_threshold_minutes", 60),
        payload.get("meetings", []),
    )
    print(json.dumps(result))


if __name__ == "__main__":
    _main()
