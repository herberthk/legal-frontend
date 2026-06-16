import * as React from 'react';
import { Html, Head, Preview, Body, Container, Section, Text, Heading, Link, Tailwind } from '@react-email/components';

interface TicketNotificationEmailProps {
  userName: string;
  ticketId: string;
  ticketSubject: string;
  messageSnippet: string;
  dashboardUrl: string;
}

export const TicketNotificationEmail: React.FC<TicketNotificationEmailProps> = ({
  userName,
  ticketId,
  ticketSubject,
  messageSnippet,
  dashboardUrl,
}) => {
  const shortTicketId = ticketId.slice(-6).toUpperCase();
  
  return (
    <Html>
      <Head />
      <Preview>New update on your Support Ticket #{shortTicketId}</Preview>
      <Tailwind>
        <Body className="bg-slate-50 font-sans text-slate-900">
          <Container className="mx-auto my-10 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
            <Heading className="text-2xl font-bold text-slate-900 mb-4">
              Update on Ticket #{shortTicketId}
            </Heading>
            
            <Text className="text-base text-slate-700 mb-4">
              Hi {userName},
            </Text>
            
            <Text className="text-base text-slate-700 mb-6">
              There has been an update to your support ticket regarding <strong>{ticketSubject}</strong>.
            </Text>

            <Section className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
              <Text className="text-sm text-slate-600 italic">
                {messageSnippet}
              </Text>
            </Section>

            <Section className="mb-6">
              <Link 
                href={dashboardUrl}
                className="bg-orange-600 text-white px-6 py-3 rounded-lg font-bold no-underline inline-block"
              >
                View Ticket & Reply
              </Link>
            </Section>
            
            <Text className="text-sm text-slate-500 mt-8 border-t border-slate-200 pt-6">
              If you have any questions, simply reply to this email or visit our help center.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
