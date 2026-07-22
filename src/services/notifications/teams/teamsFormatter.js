export function formatTeamsNotification(notification) {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: notification.title,
              weight: 'Bolder',
              size: 'Large',
              color: mapSeverityColor(notification.severity),
            },
            {
              type: 'FactSet',
              facts: [
                fact('Repository', notification.repository),
                fact('PR', `#${notification.pullNumber}`),
                fact('Risk', `${notification.riskScore} / 10`),
                fact('Severity', notification.severity),
                fact('Confidence', `${notification.confidence}%`),
                fact(
                  'Affected Systems',
                  notification.affectedSystems.join(', ') || 'None identified'
                ),
              ],
            },
            {
              type: 'TextBlock',
              text: notification.summary,
              wrap: true,
            },
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: 'View PR',
              url: notification.prUrl,
            },
          ],
        },
      },
    ],
  };
}

function fact(title, value) {
  return {
    title,
    value: String(value),
  };
}

function mapSeverityColor(severity) {
  if (severity === 'CRITICAL' || severity === 'HIGH') return 'Attention';
  if (severity === 'MEDIUM') return 'Warning';
  return 'Accent';
}
