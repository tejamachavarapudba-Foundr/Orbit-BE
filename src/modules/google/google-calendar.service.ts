import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleOAuthService } from './google-oauth.service';

const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

type CreateEventInput = {
  organizerId: string;
  attendeeEmails: string[];
  summary: string;
  description: string;
  startISO: string;
  endISO: string;
  timezone: string;
  requestId: string;
};

type GoogleEventResponse = {
  id: string;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] };
};

@Injectable()
export class GoogleCalendarService {
  constructor(private readonly oauth: GoogleOAuthService) {}

  async createEventWithMeet(input: CreateEventInput) {
    const accessToken = await this.oauth.getValidAccessToken(input.organizerId);

    // sendUpdates=none: Google's own invite email exposes the raw Meet link
    // to anyone who has it, bypassing the app entirely — attendees rely on
    // Orbit's own notifications/reminders and the in-app "Join" button
    // instead, which is what makes the join-tracking below meaningful.
    const res = await fetch(`${EVENTS_URL}?conferenceDataVersion=1&sendUpdates=none`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.startISO, timeZone: input.timezone },
        end: { dateTime: input.endISO, timeZone: input.timezone },
        attendees: input.attendeeEmails.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: input.requestId,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new InternalServerErrorException(`Google Calendar rejected the meeting: ${body}`);
    }

    const event = (await res.json()) as GoogleEventResponse;
    const meetLink =
      event.hangoutLink ??
      event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri;

    if (!meetLink) {
      throw new InternalServerErrorException('Google Calendar did not return a Meet link');
    }

    return { meetLink, googleEventId: event.id };
  }

  async deleteEvent(organizerId: string, googleEventId: string) {
    const accessToken = await this.oauth.getValidAccessToken(organizerId);
    const res = await fetch(`${EVENTS_URL}/${googleEventId}?sendUpdates=none`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // 410 Gone means the event was already removed on Google's side — not an error for us.
    if (!res.ok && res.status !== 410 && res.status !== 404) {
      throw new InternalServerErrorException('Failed to cancel the Google Calendar event');
    }
  }
}
