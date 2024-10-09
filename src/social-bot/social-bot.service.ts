import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as TelegramBot from 'node-telegram-bot-api';
import { TwitterAccount } from './schemas/twitter.accounts.schema';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { User } from './schemas/users.schema';
import {
  menuMarkup,
  viewTwitterAccount,
  welcomeMessageMarkup,
} from './markups';
import * as dotenv from 'dotenv';

import { Cron } from '@nestjs/schedule';
import { TwitterJob } from './schemas/job.schema';

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
    @InjectModel(User.name) private readonly UserModel: Model<User>,
    @InjectModel(TwitterJob.name)
    private readonly TwitterJobModel: Model<TwitterJob>,
  ) {
    this.socialBot = new TelegramBot(token, { polling: true });
    this.socialBot.on('message', this.handleRecievedMessages);
    this.socialBot.on('callback_query', this.handleButtonCommands);
    this.TwitterJobModel.deleteMany({});
    this.createTwitterJobData();
  }

  createTwitterJobData = async () => {
    await this.TwitterJobModel.deleteMany({});
    await this.TwitterJobModel.create({ isJobRunning: false });
  };

  handleRecievedMessages = async (
    msg: TelegramBot.Message,
  ): Promise<unknown> => {
    this.logger.debug(msg);
    try {
      await this.socialBot.sendChatAction(msg.chat.id, 'typing');
      function extractPlatformAndUsername(text) {
        const regex = /\/(twitter|tiktok) @(\w+)/;
        const match = text.match(regex);

        if (match) {
          return {
            platform: match[1], // "twitter" or "tiktok"
            username: match[2], // The username after "@"
          };
        } else {
          return null; // Return null if no match is found
        }
      }

      const addMatch = extractPlatformAndUsername(msg.text.trim());
      const delRegex = /^\/del\s+(twitter|tiktok)\s+(@\w+)$/;
      const delMatch = msg.text.trim().match(delRegex);

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
      } else if (addMatch) {
        if (addMatch.platform === 'twitter') {
          //TODO: VERIFY USERNAME BEFORE SAVING
          const validAccount: any = await this.validateTwitterAccount(
            addMatch.username,
            msg.chat.id,
          );
          if (validAccount.accountId) {
            const account = await this.TwitterAccountModel.findOne({
              twitterAccount: `${validAccount.twitterAccount}`,
            });
            if (account) {
              console.log(account);
              return await this.socialBot.sendMessage(
                msg.chat.id,
                `@${addMatch.username}twitter will be monitored.`,
              );
            }
            return;
          }
          return;
        } else if (addMatch.platform === 'tiktok') {
          return;
        }
        return;
      } else if (delMatch) {
        const platform = delMatch[1]; // This is either 'twitter' or 'tiktok'
        const username = delMatch[2]; // This is the @username
        if (platform == 'twitter') {
          const deletedAccount = await this.twitterRemoveTrackerChatIdOrDelete(
            username.slice(1),
            msg.chat.id,
          );

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
          return;
        }
      } else if (msg.text.trim() === '/menu') {
        const userExist = await this.UserModel.findOne({
          userChatId: msg.chat.id,
        });
        if (!userExist) {
          return await this.socialBot.sendMessage(
            msg.chat.id,
            'Start the app first, /start or click the start button',
          );
        }
        return await this.defaultMenu(msg.chat.id);
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

      switch (command) {
        case '/menu':
          try {
            await this.socialBot.sendChatAction(chatId, 'typing');
            return await this.defaultMenu(chatId);
          } catch (error) {
            console.log(error);
            return;
          }

        case '/trackX':
          try {
            await this.socialBot.sendChatAction(chatId, 'typing');
            console.log('hey');

            return await this.twitterUsernameInput(chatId);
          } catch (error) {
            console.log(error);
            return;
          }

        case '/viewX':
          try {
            await this.socialBot.sendChatAction(chatId, 'typing');
            console.log('hey');
            const twitterAccounts = await this.TwitterAccountModel.find({
              trackerChatId: { $in: [chatId] },
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
      await this.socialBot.sendMessage(chatId, '/twitter @username', {
        reply_markup: {
          force_reply: true,
        },
      });

      return;
    } catch (error) {
      console.log(error);
    }
  };

  defaultMenu = async (chatId: number) => {
    try {
      const menu = await menuMarkup();
      const replyMarkup = {
        inline_keyboard: menu.keyboard,
      };
      return await this.socialBot.sendMessage(chatId, menu.message, {
        reply_markup: replyMarkup,
      });

      return;
    } catch (error) {
      console.log(error);
    }
  };

  validateTwitterAccount = async (username: string, chatId: number) => {
    try {
      // Check if the account is already monitored
      const twitterAccount = await this.TwitterAccountModel.findOne({
        twitterAccount: username,
      });

      if (twitterAccount && +twitterAccount.trackerChatId.includes(chatId)) {
        return await this.socialBot.sendMessage(
          chatId,
          `You are already monitoring @${username} Twitter account.`,
        );
      } else if (twitterAccount) {
        await this.TwitterAccountModel.updateOne(
          {
            twitterAccount: twitterAccount.twitterAccount,
          },
          { trackerChatId: [...twitterAccount.trackerChatId, chatId] },
          //   { new: true, useFindAndModify: false },
        );
        return {
          trackerChatId: chatId,
          twitterAccount: twitterAccount.twitterAccount,
          accountId: twitterAccount.accountId,
        };
      }

      // Fetch the valid Twitter account information
      const validAccount = await this.httpService.axiosRef.get(
        `https://twitter-api-v1-1-enterprise.p.rapidapi.com/base/apitools/userByScreenNameV2?screenName=${username}&resFormat=json&apiKey=${process.env.TWITTER_API_KEY}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY,
            'x-rapidapi-host': process.env.RAPID_HOST,
          },
        },
      );

      // If valid account data is returned
      if (validAccount.data.msg === 'SUCCESS') {
        // Prepare to save new account data
        const saveTwitterUsername = new this.TwitterAccountModel({
          trackerChatId: [chatId],
          twitterAccount: username,
          accountId: validAccount.data.data.data.user.result.rest_id,
          follwersCount:
            validAccount.data.data.data.user.result.legacy.followers_count,
        });

        // Use save method with error handling to prevent duplicates
        await saveTwitterUsername.save();

        // Only fetch paginated data if save is successful
        await this.fetchTwitterPaginatedData(username);
        return {
          trackerChatId: [chatId],
          twitterAccount: username,
          accountId: validAccount.data.data.data.user.result.rest_id,
          follwersCount:
            validAccount.data.data.data.user.result.legacy.followers_count,
        };
      }
    } catch (error) {
      console.error('Error validating Twitter account:', error);
      return await this.socialBot.sendMessage(
        chatId,
        `There was an error processing your action, please try again.`,
      );
    }
  };

  fetchTwitterPaginatedData = async (username: string): Promise<void> => {
    try {
      // const params = cursor ? { cursor } : {};

      const response = await this.httpService.axiosRef.get(
        `https://twitter-api-v1-1-enterprise.p.rapidapi.com/base/apitools/followersList?cursor=-1&resFormat=json&apiKey=${process.env.TWITTER_API_KEY}&screenName=${username}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY,
            'x-rapidapi-host': process.env.RAPID_HOST,
          },
        },
      );

      const { data } = response.data;
      const formattedUsers = data.users.map((user) => ({
        UsersuserId: user.id,
        username: user.screen_name,
      }));

      // Use findOneAndUpdate with error handling
      await this.TwitterAccountModel.updateOne(
        { twitterAccount: username },
        {
          $set: {
            newAccountFollowers: formattedUsers,
            oldAccountFollowers: formattedUsers,
          },
        },
        // { new: true, useFindAndModify: false },
      );

      console.log('Fetched items:', response.data);

      // if (users.length > 0 && next_cursor > 0) {
      //   // delay in milliseconds before fetching data

      //   await this.fetchTwitterPaginatedData(userId, next_cursor);
      // } else {
      //   console.log('No more items to fetch.');
      // }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  fetchNewFollowTwitterPaginatedData = async (
    username: string,
  ): Promise<void> => {
    try {
      // const params = cursor ? { cursor } : {};
      const response = await this.httpService.axiosRef.get(
        `https://twitter-api-v1-1-enterprise.p.rapidapi.com/base/apitools/followersList?cursor=-1&resFormat=json&apiKey=${process.env.TWITTER_API_KEY}&screenName=${username}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY,
            'x-rapidapi-host': process.env.RAPID_HOST,
          },
        },
      );

      const { data } = response.data;
      const formattedUsers = data.users.map((user) => ({
        UsersuserId: user.id,
        username: user.screen_name,
      }));

      // Use findOneAndUpdate with error handling
      await this.TwitterAccountModel.updateOne(
        { twitterAccount: username },
        {
          $set: {
            newAccountFollowers: formattedUsers,
          },
        },
        //   { new: true, useFindAndModify: false },
      );
      const lastupdatedData = await this.TwitterAccountModel.findOne({
        twitterAccount: username,
      });
      if (lastupdatedData) {
        await this.notifyTwitter(
          lastupdatedData.oldAccountFollowers,
          lastupdatedData.newAccountFollowers,
          lastupdatedData.trackerChatId,
          lastupdatedData.twitterAccount,
        );
      }

      return;
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  queryNewTwitterFollowers = async (): Promise<void> => {
    try {
      const allAccounts = await this.TwitterAccountModel.find();
      console.log(allAccounts);

      if (allAccounts.length > 0) {
        await Promise.all(
          allAccounts.map(async (account) => {
            // Fetch the valid Twitter account information
            const validAccount = await this.httpService.axiosRef.get(
              `https://twitter-api-v1-1-enterprise.p.rapidapi.com/base/apitools/userByScreenNameV2?screenName=${account.twitterAccount}&resFormat=json&apiKey=${process.env.TWITTER_API_KEY}`,
              {
                headers: {
                  'Content-Type': 'application/json',
                  'x-rapidapi-key': process.env.RAPID_API_KEY,
                  'x-rapidapi-host': process.env.RAPID_HOST,
                },
              },
            );
            if (validAccount.data.msg === 'SUCCESS') {
              await this.TwitterAccountModel.updateOne(
                { twitterAccount: account.twitterAccount },
                {
                  follwersCount:
                    validAccount.data.data.data.user.result.legacy
                      .followers_count,
                },
              );
              await this.fetchNewFollowTwitterPaginatedData(
                account.twitterAccount,
              );
              return;
            }

            return;
          }),
        );
      }
      console.log('no account to monitor');
      return;

      // After updating, send notifications for new followers
    } catch (error) {
      console.error('Error querying new Twitter followers:', error);
    }
  };

  notifyTwitter = async (oldArray, newArray, chatIds, account) => {
    try {
      // Use filter to find new follows
      const addedFollows = newArray.filter((newItem) => {
        return !oldArray.some(
          (oldItem) => oldItem.username === newItem.username,
        );
      });

      if (addedFollows.length > 0) {
        await Promise.all(
          addedFollows.map(async (newFollow) => {
            try {
              chatIds.forEach(async (chatId) => {
                await this.socialBot.sendMessage(
                  chatId,
                  `Follow alert  🚨:\n\n@${newFollow.username} followed @${account} twitter account`,
                );
              });
            } catch (error) {
              console.log(error);
            }
          }),
        );
        await this.TwitterAccountModel.updateOne(
          { twitterAccount: account },
          { $set: { oldAccountFollowers: newArray } },
        );
        return;
      } else {
        console.log('No new elements added.');
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  };

  // notifyTwitterByNumber = async (
  //   oldFollowCount,
  //   newFollowCount,
  //   chatIds,
  //   account,
  // ) => {
  //   try {
  //     if (newFollowCount - oldFollowCount > 0) {
  //       chatIds.forEach(async (chatId) => {
  //         return await this.socialBot.sendMessage(
  //           chatId,
  //           `Follow alert  🚨:\n\n${newFollowCount - oldFollowCount} new accounts followed @${account} twitter account`,
  //         );
  //       });
  //     }
  //     return;
  //   } catch (error) {
  //     console.error('Error sending notifications:', error);
  //   }
  // };

  //cronJob

  // @Cron('*/30 * * * *')
  @Cron(`${process.env.CRON}`)
  async handleTwitterCron() {
    const jobRunning = await this.TwitterJobModel.find();
    if (jobRunning[0].isJobRunning) {
      // If a job is already running, exit early to prevent data pollution

      return;
    }

    // Set the flag to indicate the job is running
    await this.TwitterJobModel.updateOne(
      { _id: jobRunning[0]._id },
      { isJobRunning: true },
    );

    try {
      // Call your function to query new Twitter followers
      await this.queryNewTwitterFollowers();
    } catch (error) {
      // Handle any errors that may occur during execution
      console.error('Error in cron job:', error);
    } finally {
      // Reset the flag to indicate the job has completed
      await this.TwitterJobModel.updateOne(
        { _id: jobRunning[0]._id },
        { isJobRunning: false },
      );
    }
  }

  // utility functions:
  async twitterRemoveTrackerChatIdOrDelete(username: string, chatId: number) {
    try {
      // Find the document by twitterAccount
      const account = await this.TwitterAccountModel.findOne({
        twitterAccount: username,
      });

      if (account) {
        const { trackerChatId } = account;

        // Check if trackerChatId exists in the array
        if (trackerChatId.includes(chatId)) {
          if (trackerChatId.length > 1) {
            // If there are multiple trackerChatIds, remove the specific chatId
            return await this.TwitterAccountModel.findOneAndUpdate(
              { twitterAccount: username },
              { $pull: { trackerChatId: chatId } },
            );
          } else {
            // If it's the only trackerChatId, delete the document
            return await this.TwitterAccountModel.findOneAndDelete({
              twitterAccount: username,
            });
          }
        } else {
          console.log('Tracker chat ID not found.');
        }
      } else {
        console.log('Twitter account not found.');
      }
    } catch (error) {
      console.error('Error in TwitterremoveTrackerChatIdOrDelete:', error);
    }
  }
}
