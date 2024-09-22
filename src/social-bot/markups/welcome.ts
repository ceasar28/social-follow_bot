export const welcomeMessageMarkup = async (userName: string) => {
  return {
    message: `Hi @${userName},Welcome to Instagram follower Tracker bot`,

    keyboard: [
      [
        {
          text: 'track Instagram account 📸',
          callback_data: JSON.stringify({
            command: '/trackInsta',
            language: 'twitter',
          }),
        },
        {
          text: 'view all tracked Instagram account',
          callback_data: JSON.stringify({
            command: '/viewInsta',
            language: 'twitter',
          }),
        },
      ],
    ],
  };
};
