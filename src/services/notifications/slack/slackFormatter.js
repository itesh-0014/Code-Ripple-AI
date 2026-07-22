export function formatSlackNotification(notification) {
  const affectedSystems = notification.affectedSystems.length
    ? notification.affectedSystems.map(system => `• ${system}`).join('\n')
    : 'None identified';

  return {
    text: `${notification.title}: ${notification.repository} PR #${notification.pullNumber}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: notification.title,
        },
      },
      {
        type: 'section',
        fields: [
          markdownField('*Repository*', notification.repository),
          markdownField('*PR*', `#${notification.pullNumber}`),
          markdownField('*Risk*', `${notification.riskScore} / 10`),
          markdownField('*Severity*', notification.severity),
          markdownField('*Confidence*', `${notification.confidence}%`),
          markdownField('*Alert Type*', notification.templateName),
        ],
      },
      {
        type: 'section',
        text: markdownField('*Affected Systems*', affectedSystems),
      },
      {
        type: 'section',
        text: markdownField('*Summary*', notification.summary),
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View PR',
            },
            url: notification.prUrl,
            style: notification.severity === 'CRITICAL' ? 'danger' : undefined,
          },
        ],
      },
    ],
  };
}

function markdownField(label, value) {
  return {
    type: 'mrkdwn',
    text: `${label}\n${value}`,
  };
}
