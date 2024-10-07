export const welcomeMessageMarkup = async (userName: string) => {
  return {
    message: `Hi @${userName},Welcome to Twitter follower Tracker bot`,

    keyboard: [
      [
        {
          text: 'track X account 🐦',
          callback_data: JSON.stringify({
            command: '/trackX',
            language: 'twitter',
          }),
        },
        {
          text: 'view all tracked X account',
          callback_data: JSON.stringify({
            command: '/viewX',
            language: 'twitter',
          }),
        },
      ],
    ],
  };
};
