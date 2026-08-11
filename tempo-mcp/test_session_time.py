import unittest

from session_time import calculate_time, eligible_meetings, allocate_eligible_time


class SessionTimeTests(unittest.TestCase):
    def test_splits_active_time_by_day_and_ignores_hour_gaps(self):
        result = calculate_time(
            [
                "2026-08-10T23:50:00+02:00",
                "2026-08-11T00:10:00+02:00",
                "2026-08-11T01:20:00+02:00",
                "2026-08-11T02:00:00+02:00",
            ],
            gap_threshold_minutes=60,
        )

        self.assertEqual(result["total_seconds"], 3_600)
        self.assertEqual(result["by_day"], {"2026-08-10": 600, "2026-08-11": 3_000})

    def test_excludes_focus_time_and_declined_events(self):
        events = [
            {"eventType": "FOCUS_TIME", "attendees": [{"self": True, "responseStatus": "accepted"}]},
            {"eventType": "DEFAULT", "attendees": [{"self": True, "responseStatus": "declined"}]},
            {"eventType": "DEFAULT", "attendees": [{"self": True, "responseStatus": "accepted"}, {"email": "other@example.com"}]},
        ]

        self.assertEqual(eligible_meetings(events), [events[2]])

    def test_subtracts_attended_meeting_overlap(self):
        result = calculate_time(
            [
                "2026-08-11T09:00:00+02:00",
                "2026-08-11T10:00:00+02:00",
            ],
            gap_threshold_minutes=60,
            meetings=[
                {
                    "start": {"dateTime": "2026-08-11T09:15:00+02:00"},
                    "end": {"dateTime": "2026-08-11T09:45:00+02:00"},
                    "eventType": "DEFAULT",
                    "attendees": [
                        {"self": True, "responseStatus": "accepted"},
                        {"email": "other@example.com"},
                    ],
                }
            ],
        )

        self.assertEqual(result["total_seconds"], 1_800)
        self.assertEqual(result["by_day"], {"2026-08-11": 1_800})

    def test_allocates_approved_time_across_available_days(self):
        self.assertEqual(
            allocate_eligible_time(3_600, {"2026-08-10": 1_800, "2026-08-11": 3_600}),
            {"2026-08-10": 1_800, "2026-08-11": 1_800},
        )


if __name__ == "__main__":
    unittest.main()
