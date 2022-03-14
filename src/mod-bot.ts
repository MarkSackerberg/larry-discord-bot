import { Guild, GuildMember, Interaction, Client, Intents } from 'discord.js';
import {
    getCommands,
    setupCommands,
    setupGuild,
} from './common/slash-commands';
import { handleChangeUsername, handleOnJoin } from './mod-bot/member-changes';
import modCommands from './mod-bot/commands';
import log from 'loglevel';
import dotenv from 'dotenv';
import { connectDatabase } from './common/connect-db';
dotenv.config();

log.setLevel(log.levels.DEBUG);

process.on('unhandledRejection', (error) => {
    log.error('Unhandled promise rejection:', error);
});

// Create a new discord client
const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS],
});

client.login(process.env.MOD_BOT_TOKEN);

// When the client is ready, run this code (only once)
client.once('ready', async () => {
    log.info('Ready!');
    const mongoUri = process.env.MOD_BOT_MONGO_URI;
    if (mongoUri === undefined) {
        throw new Error('Bad mongo env');
    }
    await connectDatabase(mongoUri);
    await main();
});

async function main() {
    if (!client.isReady()) throw new Error("Client isnt ready?");

    // const { guilds, commands } = await setupCommands(client, modCommands);
    const commands = getCommands(modCommands);
    // return;
    client.on('interactionCreate', async (interaction: Interaction) => {
        if (!interaction.isCommand()) return;
        log.debug('Command Name: ', interaction.commandName);
        const theCommand = commands.get(interaction.commandName);
        if (!theCommand) return;
        if (!interaction.inCachedGuild()) {
            log.info('cry');
            return;
        }
        try {
            await theCommand.execute(interaction);
        } catch (error) {
            log.error(error);
            await interaction.reply({
                content: 'There was an error while executing this command!',
                ephemeral: true,
            });
        }
    });

    client.on('guildMemberAdd', async (guildMember: GuildMember) => {
        await handleOnJoin(guildMember);
    });

    client.on('guildCreate', async (guild: Guild) => {
        await setupGuild(guild, modCommands);
        log.info('Successfully setup new guild: ', guild.name);
    });

    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (oldMember.user.username !== newMember.user.username){
            await handleChangeUsername(newMember);
        }
    });
}
