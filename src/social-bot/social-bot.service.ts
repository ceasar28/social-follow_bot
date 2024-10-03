import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as TelegramBot from 'node-telegram-bot-api';
import { TwitterAccount } from './schemas/twitter.accounts.schema';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { User } from './schemas/users.schema';
import { TiktokAccount } from './schemas/tiktok.accounts.schema';
import {
  viewTiktokAccount,
  viewTwitterAccount,
  welcomeMessageMarkup,
} from './markups';
import * as dotenv from 'dotenv';
import { Session } from './schemas/session.schema';

dotenv.config();

const token = process.env.TEST_TOKEN;

@Injectable()
export class SocialBotService {
  private readonly socialBot: TelegramBot;
  private logger = new Logger(SocialBotService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(TwitterAccount.name)
    private readonly TwitterAccountModel: Model<TwitterAccount>,
    @InjectModel(TiktokAccount.name)
    private readonly TiktokAccountModel: Model<TiktokAccount>,
    @InjectModel(Session.name) private readonly SessionModel: Model<Session>,
    @InjectModel(User.name) private readonly UserModel: Model<User>,
  ) {
    this.socialBot = new TelegramBot(token, { polling: true });
    this.socialBot.on('message', this.handleRecievedMessages);
    this.socialBot.on('callback_query', this.handleButtonCommands);
  }

  handleRecievedMessages = async (
    msg: TelegramBot.Message,
  ): Promise<unknown> => {
    this.logger.debug(msg);
    try {
      await this.socialBot.sendChatAction(msg.chat.id, 'typing');
      const regex = /^\/del\s+(twitter|tiktok)\s+(@\w+)$/;

      const match = msg.text.trim().match(regex);
      if (msg.text.trim() === '/start') {
        const userExist = await this.UserModel.findOne({
          userChatId: msg.chat.id,
        });
        if (!userExist) {
          const savedUser = new this.UserModel({
            userChatId: msg.chat.id,
            username: msg.from.username,
          });
          savedUser.save();
        }
        const username: string = `${msg.from.username}`;
        const welcome = await welcomeMessageMarkup(username);
        const replyMarkup = {
          inline_keyboard: welcome.keyboard,
        };
        return await this.socialBot.sendMessage(msg.chat.id, welcome.message, {
          reply_markup: replyMarkup,
        });
      } else if (/^@/.test(msg.text.trim())) {
        const session = await this.SessionModel.findOne({
          userChatId: msg.chat.id,
        });
        if (session && session.prompt && session.type === 'twitter') {
          //TODO: VERIFY USERNAME BEFORE SAVING
          const validAccount: any = await this.validateTwitterAccount(
            msg.text.trim().startsWith('@')
              ? msg.text.trim().slice(1)
              : msg.text.trim(),
            msg.chat.id,
          );
          if (validAccount.accountId) {
            console.log(validAccount);
            const account = await this.TwitterAccountModel.findOne({
              twitterAccount: `${validAccount.twitterAccount}`,
            });
            if (account) {
              console.log(account);
              return await this.socialBot.sendMessage(
                msg.chat.id,
                `${msg.text.trim()} twitter will be monitored\n\nFollower: ${account.followers_count}\nfollows: ${account.friends_count}`,
              );
            }
            return;
          }
          return;
        } else if (session && session.prompt && session.type === 'tiktok') {
          //TODO: VERIFY USERNAME BEFORE SAVING
          const saveTiktokUsername = new this.TiktokAccountModel({
            trackerChatId: msg.chat.id,
            tiktokAccount: msg.text.trim(),
          });
          saveTiktokUsername.save();
          if (saveTiktokUsername) {
            await this.socialBot.sendMessage(
              msg.chat.id,
              `${saveTiktokUsername.tiktokAccount} tiktok account will be monitored`,
            );
            return;
          }
          return;
        }
        return;
      } else if (match) {
        const platform = match[1]; // This is either 'twitter' or 'tiktok'
        const username = match[2]; // This is the @username
        if (platform == 'twitter') {
          const deletedAccount =
            await this.TwitterAccountModel.findOneAndDelete({
              twitterAccount: username.slice(1),
            });
          if (deletedAccount) {
            return await this.socialBot.sendMessage(
              msg.chat.id,
              `${deletedAccount.twitterAccount} has been removed`,
            );
          }
          return await this.socialBot.sendMessage(
            msg.chat.id,
            'There was an error processing your message',
          );
        } else if (platform == 'tiktok') {
          const deletedAccount = await this.TiktokAccountModel.findOneAndDelete(
            {
              tiktokAccount: username.slice(1),
            },
          );
          if (deletedAccount) {
            return await this.socialBot.sendMessage(
              msg.chat.id,
              `${deletedAccount.tiktokAccount} has been removed`,
            );
          }
          return await this.socialBot.sendMessage(
            msg.chat.id,
            'There was an error processing your message',
          );
        }
      }
    } catch (error) {
      console.log(error);
      return await this.socialBot.sendMessage(
        msg.chat.id,
        'There was an error processing your message',
      );
    }
  };

  handleButtonCommands = async (
    query: TelegramBot.CallbackQuery,
  ): Promise<unknown> => {
    this.logger.debug(query);
    let command: string;

    // const username = `${query.from.username}`;
    const chatId = query.message.chat.id;

    // function to check if query.data is a json type
    function isJSON(str: string) {
      try {
        JSON.parse(str);
        return true;
      } catch (e) {
        console.log(e);
        return false;
      }
    }

    if (isJSON(query.data)) {
      command = JSON.parse(query.data).command;
    } else {
      command = query.data;
    }

    try {
      console.log(command);
      let session;
      switch (command) {
        case '/trackX':
          try {
            await this.socialBot.sendChatAction(chatId, 'typing');
            console.log('hey');
            session = await this.SessionModel.findOne({
              userChatId: chatId,
            });
            if (!session) {
              const startSession = new this.SessionModel({
                userChatId: chatId,
                type: 'twitter',
              });
              startSession.save();
              return await this.twitterUsernameInput(chatId);
            }
            await this.SessionModel.findByIdAndUpdate(session._id, {
              type: 'twitter',
            });
            return await this.twitterUsernameInput(chatId);
          } catch (error) {
            console.log(error);
            return;
          }

        case '/trackTiktok':
          try {
            await this.socialBot.sendChatAction(chatId, 'typing');
            console.log('hey');
            session = await this.SessionModel.findOne({
              userChatId: chatId,
            });
            if (!session) {
              const startSession = new this.SessionModel({
                userChatId: chatId,
                type: 'tiktok',
              });
              startSession.save();
              return await this.tiktokUsernameInput(chatId);
            }
            await this.SessionModel.findByIdAndUpdate(session._id, {
              type: 'tiktok',
            });
            return await this.tiktokUsernameInput(chatId);
          } catch (error) {
            console.log(error);
            return;
          }

        case '/viewX':
          try {
            await this.socialBot.sendChatAction(chatId, 'typing');
            console.log('hey');
            const twitterAccounts = await this.TwitterAccountModel.find({
              trackerChatId: chatId,
            });

            const allTwitteraccounts = [...twitterAccounts];
            const twitterMarkup = await viewTwitterAccount(allTwitteraccounts);
            const twitterReplyMarkup = {
              inline_keyboard: twitterMarkup.keyboard,
            };

            return await this.socialBot.sendMessage(
              chatId,
              twitterMarkup.message,
              {
                reply_markup: twitterReplyMarkup,
              },
            );
          } catch (error) {
            console.log(error);
            return;
          }

        case '/viewTiktok':
          try {
            await this.socialBot.sendChatAction(chatId, 'typing');
            console.log('hey');
            const tiktokAccounts = await this.TiktokAccountModel.find({
              trackerChatId: chatId,
            });

            const alltiktokAccounts = [...tiktokAccounts];
            const tiktokMarkup = await viewTiktokAccount(alltiktokAccounts);
            const tiktokMarkupReply = {
              inline_keyboard: tiktokMarkup.keyboard,
            };

            return await this.socialBot.sendMessage(
              chatId,
              tiktokMarkup.message,
              {
                reply_markup: tiktokMarkupReply,
              },
            );
          } catch (error) {
            console.log(error);
            return;
          }

        case '/close':
          await this.socialBot.sendChatAction(query.message.chat.id, 'typing');
          return await this.socialBot.deleteMessage(
            query.message.chat.id,
            query.message.message_id,
          );

        default:
          return await this.socialBot.sendMessage(
            chatId,
            'There was an error processing your message',
          );
      }
    } catch (error) {
      console.log(error);
      return await this.socialBot.sendMessage(
        chatId,
        'There was an error processing your message',
      );
    }
  };

  twitterUsernameInput = async (chatId: number) => {
    try {
      await this.socialBot.sendMessage(
        chatId,
        'twitter username to track (must start with @)',
        {
          reply_markup: {
            force_reply: true,
          },
        },
      );

      await this.SessionModel.findOneAndUpdate(
        {
          userChatId: chatId,
        },
        { prompt: true },
      );

      //   const session = await this.SessionModel.findOne({
      //     userChatId: chatId,
      //   });
      //   if (usernamePrompt) {
      //     await this.SessionModel.findOneAndUpdate(
      //       { userChatId: session._id },
      //       { promptIds: [...session.promptIds, usernamePrompt.message_id] },
      //     );
      //     return;
      //   }

      return;
    } catch (error) {
      console.log(error);
    }
  };

  tiktokUsernameInput = async (chatId: number) => {
    try {
      await this.socialBot.sendMessage(
        chatId,
        'tiktok username to track (must start with @)',
        {
          reply_markup: {
            force_reply: true,
          },
        },
      );

      await this.SessionModel.findOneAndUpdate(
        {
          userChatId: chatId,
        },
        { prompt: true },
      );
      //   if (usernamePrompt) {
      //     await this.SessionModel.findOneAndUpdate(
      //       { userChatId: session._id },
      //       { promptIds: [...session.promptIds, usernamePrompt.message_id] },
      //     );
      //     return;
      //   }

      return;
    } catch (error) {
      console.log(error);
    }
  };

  validateTwitterAccount = async (username: string, chatId: number) => {
    try {
      const twitterAccount = await this.TwitterAccountModel.findOne({
        twitterAccount: username,
        trackerChatId: chatId,
      });
      if (twitterAccount) {
        return await this.socialBot.sendMessage(
          chatId,
          `you are already monitoring @${username} twitter account\n\nFollower: ${twitterAccount.followers_count}\nfollows: ${twitterAccount.friends_count}`,
        );
      }

      const validAccount = await this.httpService.axiosRef.get(
        `https://twitter-api47.p.rapidapi.com/v2/user/by-username?username=${username}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY,
            'x-rapidapi-host': process.env.RAPID_HOST,
          },
        },
      );
      if (validAccount.data) {
        const saveTwitterUsername = new this.TwitterAccountModel({
          trackerChatId: chatId,
          twitterAccount: username,
          accountId: validAccount.data.rest_id,
          followers_count: validAccount.data.legacy.followers_count,
          friends_count: validAccount.data.legacy.friends_count,
        });
        saveTwitterUsername.save();

        if (saveTwitterUsername) {
          return {
            trackerChatId: chatId,
            twitterAccount: username,
            accountId: validAccount.data.rest_id,
            followers_count: validAccount.data.legacy.followers_count,
            friends_count: validAccount.data.legacy.friends_count,
          };
        }
        return;
      }
    } catch (error) {
      console.log(error);
      return await this.socialBot.sendMessage(
        chatId,
        `There was an error processing your action, try again`,
      );
    }
  };

  //   queryTwitterAccounts = async () => {
  //     try {
  //       const monitoredAccounts = await this.TwitterAccountModel.find();

  //       const updates = await this.httpService.axiosRef.post(
  //         process.env.GRAPHQL_URL,
  //         body,
  //         {
  //           headers: {
  //             'Content-Type': 'application/json',
  //           },
  //         },
  //       );
  //     } catch (error) {
  //       console.log(error);
  //     }
  //   };
}

//    const getFollowers = await this.httpService.axiosRef.get(
//      `https://twitter-api47.p.rapidapi.com/v2/user/by-username?username=spacex`,
//      {
//        headers: {
//          'Content-Type': 'application/json',
//          'x-rapidapi-key': process.env.RAPID_API_KEY,
//          'x-rapidapi-host': process.env.RAPID_HOST,
//        },
//      },
//    );
