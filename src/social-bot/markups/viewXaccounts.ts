export const viewTwitterAccount = async (accounts: any[]) => {
  const allAccounts = accounts;
  return {
    message:
      allAccounts.length === 0
        ? `you don't have any twitter account to monitor.\nadd a username to monitor`
        : `Twitter Accounts:\n${allAccounts.map((account) => `@${account['twitterAccount']}`).join('\n')}`,

    keyboard: [
      [
        {
          text: '❌ Close',
          callback_data: JSON.stringify({
            command: '/close',
            language: 'english',
          }),
        },
      ],
    ],
  };
};
