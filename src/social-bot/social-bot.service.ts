import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as TelegramBot from 'node-telegram-bot-api';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { User } from './schemas/users.schema';
import { TiktokAccount } from './schemas/tiktok.accounts.schema';
import { menuMarkup, viewTiktokAccount, welcomeMessageMarkup } from './markups';
import * as dotenv from 'dotenv';

import { Cron } from '@nestjs/schedule';
import { TiktokJob } from './schemas/job.schema';
import { AddedFollower } from './schemas/addedFollower.schema';

dotenv.config();

const token = process.env.TEST_TOKEN;

@Injectable()
export class SocialBotService {
  private readonly socialBot: TelegramBot;
  private logger = new Logger(SocialBotService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(TiktokAccount.name)
    private readonly TiktokAccountModel: Model<TiktokAccount>,
    @InjectModel(User.name) private readonly UserModel: Model<User>,
    @InjectModel(TiktokJob.name)
    private readonly TiktokJobModel: Model<TiktokJob>,
    @InjectModel(AddedFollower.name)
    private readonly AddedFollowerModel: Model<AddedFollower>,
  ) {
    this.socialBot = new TelegramBot(token, { polling: true });
    this.socialBot.on('message', this.handleRecievedMessages);
    this.socialBot.on('callback_query', this.handleButtonCommands);

    this.TiktokJobModel.deleteMany({});
    this.createTiktokJobData();
  }

  createTiktokJobData = async () => {
    await this.TiktokJobModel.deleteMany({});
    await this.TiktokJobModel.create({ isJobRunning: false });
  };

  handleRecievedMessages = async (
    msg: TelegramBot.Message,
  ): Promise<unknown> => {
    this.logger.debug(msg);
    try {
      await this.socialBot.sendChatAction(msg.chat.id, 'typing');
      function extractPlatformAndUsername(text) {
        // Adjusted regex pattern to match the username with more characters and optional whitespace
        const regex = /\/(twitter|tiktok)\s*@([\w.]+)/;
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
      // const delRegex = /^\/del\s+(twitter|tiktok)\s+(@\w+)$/;
      // const delRegex = /^\/del\s+(twitter|tiktok)\s+@([\w.]+)$/;
      const delRegex = /^\/del\s+(twitter|tiktok)\s+@([\w.]+)$/;
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
          return;
        } else if (addMatch.platform === 'tiktok') {
          //TODO: VERIFY USERNAME BEFORE SAVING
          const validAccount: any = await this.validateTiktokAccount(
            addMatch.username,
            msg.chat.id,
          );
          if (validAccount.tiktokAccount) {
            const account = await this.TiktokAccountModel.findOne({
              tiktokAccount: `${validAccount.tiktokAccount}`,
            });
            if (account) {
              console.log(account);
              return await this.socialBot.sendMessage(
                msg.chat.id,
                `@${addMatch.username} tiktok will be monitored.`,
              );
            }
            return;
          }
          return;
        }
        return;
      } else if (delMatch) {
        const platform = delMatch[1]; // This is either 'twitter' or 'tiktok'
        const username = delMatch[2]; // This is the @username
        if (platform == 'twitter') {
          return;
        } else if (platform == 'tiktok') {
          const deletedAccount = await this.tiktokRemoveTrackerChatIdOrDelete(
            username,
            msg.chat.id,
          );
          if (deletedAccount) {
            return await this.socialBot.sendMessage(
              msg.chat.id,
              `@${deletedAccount.tiktokAccount} has been removed`,
            );
          }
          return await this.socialBot.sendMessage(
            msg.chat.id,
            'There was an error processing your message',
          );
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

        case '/trackTiktok':
          try {
            await this.socialBot.sendChatAction(chatId, 'typing');
            console.log('hey');
            return await this.tiktokUsernameInput(chatId);
          } catch (error) {
            console.log(error);
            return;
          }

        case '/viewTiktok':
          try {
            await this.socialBot.sendChatAction(chatId, 'typing');
            console.log('hey');
            const tiktokAccounts = await this.TiktokAccountModel.find({
              trackerChatId: { $in: [chatId] },
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

  tiktokUsernameInput = async (chatId: number) => {
    try {
      await this.socialBot.sendMessage(chatId, '/tiktok @username', {
        reply_markup: {
          force_reply: true,
        },
      });

      return;
    } catch (error) {
      console.log(error);
    }
  };

  validateTiktokAccount = async (username: string, chatId: number) => {
    try {
      // Check if the account is already monitored
      const tiktokAccount = await this.TiktokAccountModel.findOne({
        tiktokAccount: username,
      });

      if (tiktokAccount && +tiktokAccount.trackerChatId.includes(chatId)) {
        return await this.socialBot.sendMessage(
          chatId,
          `You are already monitoring @${username} Tiktok account.`,
        );
      } else if (tiktokAccount) {
        await this.TiktokAccountModel.updateOne(
          {
            tiktokAccount: tiktokAccount.tiktokAccount,
          },
          { trackerChatId: [...tiktokAccount.trackerChatId, chatId] },
          //   { new: true, useFindAndModify: false },
        );
        return {
          trackerChatId: chatId,
          tiktokAccount: tiktokAccount.tiktokAccount,
          accountId: tiktokAccount.accountId,
        };
      }

      // Fetch the valid Tiktok account information
      const validAccount = await this.httpService.axiosRef.get(
        `https://tiktok-data-api2.p.rapidapi.com/user/follower?username=${username}&count=20`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY,
            'x-rapidapi-host': process.env.RAPID_HOST,
          },
        },
      );

      // If valid account data is returned
      if (validAccount.data.code === 200) {
        // Prepare to save new account data
        const saveTiktokUsername = new this.TiktokAccountModel({
          trackerChatId: [chatId],
          tiktokAccount: username,
          accountId: '',
          follwersCount: validAccount.data.data.total,
        });

        // Use save method with error handling to prevent duplicates
        await saveTiktokUsername.save();

        // Only fetch paginated data if save is successful
        await this.fetchTiktokPaginatedData(username);
        return {
          trackerChatId: [chatId],
          tiktokAccount: username,
          accountId: '',
          follwersCount: validAccount.data.data.total,
        };
      }
    } catch (error) {
      console.error('Error validating Tiktok account:', error);
      return await this.socialBot.sendMessage(
        chatId,
        `There was an error processing your action, please try again.`,
      );
    }
  };

  fetchTiktokPaginatedData = async (username: string): Promise<void> => {
    try {
      // const min_time = this.getLastHourUnix();

      const response = await this.httpService.axiosRef.get(
        `https://tiktok-data-api2.p.rapidapi.com/user/follower?username=${username}&count=20`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY,
            'x-rapidapi-host': process.env.RAPID_HOST,
          },
        },
      );

      const { data } = response.data;
      const formattedUsers = data.followers.map((user) => ({
        UsersuserId: user.uid,
        username: user.unique_id,
      }));

      // Use findOneAndUpdate with error handling
      await this.TiktokAccountModel.updateOne(
        { tiktokAccount: username },
        {
          $set: {
            newAccountFollowers: formattedUsers,
            oldAccountFollowers: formattedUsers,
          },
        },
        // { new: true, useFindAndModify: false },
      );

      console.log('Fetched items:', formattedUsers);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  fetchNewFollowTiktokPaginatedData = async (
    username: string,
  ): Promise<void> => {
    try {
      const response = await this.httpService.axiosRef.get(
        `https://tiktok-data-api2.p.rapidapi.com/user/follower?username=${username}&count=20`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY,
            'x-rapidapi-host': process.env.RAPID_HOST,
          },
        },
      );

      const { data } = response.data;
      const formattedUsers = data.followers.map((user) => ({
        UsersuserId: user.uid,
        username: user.unique_id,
      }));

      await this.TiktokAccountModel.updateOne(
        { tiktokAccount: username },
        {
          $set: {
            newAccountFollowers: formattedUsers,
          },
        },
        //   { new: true, useFindAndModify: false },
      );
      const lastupdatedData = await this.TiktokAccountModel.findOne({
        tiktokAccount: username,
      });
      if (lastupdatedData) {
        await this.notifyTiktok(
          lastupdatedData.oldAccountFollowers,
          lastupdatedData.newAccountFollowers,
          lastupdatedData.trackerChatId,
          lastupdatedData.tiktokAccount,
        );
      }
      return;
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  queryNewTiktokFollowers = async (): Promise<void> => {
    try {
      const allAccounts = await this.TiktokAccountModel.find();
      console.log(allAccounts);

      if (allAccounts.length > 0) {
        // Fetch new followers in parallel for all accounts
        await Promise.all(
          allAccounts.map(async (account) => {
            const validAccount = await this.httpService.axiosRef.get(
              `https://tiktok-data-api2.p.rapidapi.com/user/follower?username=${account.tiktokAccount}&count=20`,
              {
                headers: {
                  'Content-Type': 'application/json',
                  'x-rapidapi-key': process.env.RAPID_API_KEY,
                  'x-rapidapi-host': process.env.RAPID_HOST,
                },
              },
            );
            if (validAccount.data.code === 200) {
              await this.TiktokAccountModel.updateOne(
                {
                  tiktokAccount: account.tiktokAccount,
                },
                { follwersCount: validAccount.data.data.total },
              );
              await this.fetchNewFollowTiktokPaginatedData(
                account.tiktokAccount,
              );
              return;
            }
            await this.fetchNewFollowTiktokPaginatedData(account.tiktokAccount);
            return;
          }),
        );
        return;
      }
      console.log('no account to monitor');
      return;

      // After updating, send notifications for new followers
    } catch (error) {
      console.error('Error querying new Tiktok followers:', error);
    }
  };

  notifyTiktok = async (oldArray, newArray, chatIds, account) => {
    try {
      // const alertedFollowers = await this.AddedFollowerModel.find();
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
                  `Follow alert  🚨:\n\n<a href="https://www.tiktok.com/@${newFollow.username}">@${newFollow.username}</a> followed @${account} tiktok Account`,
                  { parse_mode: 'HTML' },
                );
              });
            } catch (error) {
              console.log(error);
            }
          }),
        );

        await this.TiktokAccountModel.updateOne(
          { tiktokAccount: account },
          { $set: { oldAccountFollowers: newArray } },
        );
        return;
      } else {
        await this.TiktokAccountModel.updateOne(
          { tiktokAccount: account },
          { $set: { oldAccountFollowers: newArray } },
        );
        console.log('No new elements added.');
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  };

  notifyTiktokByNumber = async (
    oldFollowCount,
    newFollowCount,
    chatIds,
    account,
  ) => {
    try {
      if (newFollowCount - oldFollowCount > 0) {
        chatIds.forEach(async (chatId) => {
          return await this.socialBot.sendMessage(
            chatId,
            `Follow alert  🚨:\n\n${newFollowCount - oldFollowCount} followed @${account} tiktok Account`,
          );
        });
      }
      return;
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  };
  //cronJob

  // @Cron('*/1 * * * *')
  @Cron(`${process.env.CRON}`)
  async handleTiktokCron() {
    const jobRunning = await this.TiktokJobModel.find();
    if (jobRunning[0].isJobRunning) {
      // If a job is already running, exit early to prevent data pollution
      console.log('Job is running');
      return;
    }

    // Set the flag to indicate the job is running
    await this.TiktokJobModel.updateOne(
      { _id: jobRunning[0]._id },
      { isJobRunningTiktok: true },
    );

    try {
      // Call your function to query new Twitter followers
      await this.queryNewTiktokFollowers();
    } catch (error) {
      // Handle any errors that may occur during execution
      console.error('Error in cron job:', error);
    } finally {
      // Reset the flag to indicate the job has completed
      await this.TiktokJobModel.updateOne(
        { _id: jobRunning[0]._id },
        { isJobRunning: false },
      );
    }
  }

  // utility functions:

  async tiktokRemoveTrackerChatIdOrDelete(username: string, chatId: number) {
    try {
      console.log(username);
      // Find the document by twitterAccount
      const account = await this.TiktokAccountModel.findOne({
        tiktokAccount: username,
      });

      if (account) {
        console.log(account);
        const { trackerChatId } = account;

        // Check if trackerChatId exists in the array
        if (trackerChatId.includes(chatId)) {
          if (trackerChatId.length > 1) {
            // If there are multiple trackerChatIds, remove the specific chatId
            return await this.TiktokAccountModel.findOneAndUpdate(
              { tiktokAccount: username },
              { $pull: { trackerChatId: chatId } },
            );
          } else {
            // If it's the only trackerChatId, delete the document
            return await this.TiktokAccountModel.findOneAndDelete({
              tiktokAccount: username,
            });
          }
        } else {
          console.log('Tracker chat ID not found.');
        }
      } else {
        console.log('Twitter account not found.');
      }
    } catch (error) {
      console.error('Error in tiktokRemoveTrackerChatIdOrDelete:', error);
    }
  }

  getLastTwoMinutesUnix(): number {
    const currentTime = Math.floor(Date.now() / 1000); // Get current time in seconds (Unix timestamp)
    const twoMinutesInSeconds = 2 * 60; // 2 minutes converted to seconds
    const lastTwoMinutes = currentTime - twoMinutesInSeconds; // Subtract 2 minutes from current time
    return lastTwoMinutes;
  }
  getLastHourUnix(): number {
    const currentTime = Math.floor(Date.now() / 1000); // Get current time in seconds (Unix timestamp)
    const oneHourInSeconds = 1 * 60 * 60; // 1 hour converted to seconds (3600 seconds)
    const lastHour = currentTime - oneHourInSeconds; // Subtract 1 hour from current time
    return lastHour;
  }
}
