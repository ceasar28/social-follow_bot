export const menuMarkup = async () => {
  return {
    message: `Choose an option:`,

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
