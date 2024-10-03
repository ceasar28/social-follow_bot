export const viewTiktokAccount = async (accounts: any[]) => {
  const allAccounts = accounts;
  return {
    message:
      allAccounts.length === 0
        ? `you don't have any tiktok account to monitor.\nadd a username to monitor`
        : `Tiktok Accounts:\n${allAccounts.map((account) => `@${account['tiktokAccount']}`).join('\n')}`,

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
