export const viewInstagramAccount = async (accounts: any[]) => {
  const allAccounts = accounts;
  return {
    message:
      allAccounts.length === 0
        ? `you don't have any Instagram account to monitor.\nadd a username to monitor`
        : `Instagram Accounts:\n${allAccounts.map((account) => `@${account['tiktokAccount']}`).join('\n')}\n\n to remove an account type use the format:\n /del instagram @username`,

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
