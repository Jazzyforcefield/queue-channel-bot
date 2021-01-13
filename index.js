/*
 * Copyright 2021 Michael Ung
 * 
 * Utils Bot using discord.js
 * 
 * Not yet robust version
 * 
 * TODO: config file, anonymous questions
 */

// Discord
const Discord = require('discord.js');
const client = new Discord.Client();

// Config
const bot_name = 'Q-Chan'
const command_prefix = '!';

const bot_token = '';	// Put bot token here
const server_id = '';	// Put server id here

var logs_enabled = true;

// Channels
const lab_category = 'Lab Channels';
const office_category = 'Office Hours';
const work_category = 'Work Rooms';

var num_lab_channels = 8;
var num_office_channels = 4;
var num_work_channels = 4;
var temp_channels = []; // Maybe store id's instead to save space

// Queue
var queue = new Set();

// Misc
var bot_channel = null;
const help_string = `Using the '${command_prefix}' prefix, here are the commands that you are able to use:\n`
    + `> help - Lists commands that you can use\n\n`
    + `**Channel creation commands:**\n`
    + `> *lab-channel* - Creates a voice channel in the lab section that lasts until you disconnect from it\n`
    + `> *office-channel* - Creates a voice channel in the office hour section that lasts until you disconnect from it\n`
    + `> *work-channel* - Creates a voice channel in the work room section that lasts until you disconnect from it\n`
    + `> Example: '${command_prefix}lab-channel', '${command_prefix}office-channel', and '${command_prefix}work-channel'\n\n`
    + `**Queue commands:**\n`
    + `> *queue* - You can use 'join', 'leave', or 'show' as a second parameter to join, leave, or show the queue\n`
    + `> Example: '${command_prefix}queue join',  '${command_prefix}queue leave', and '${command_prefix}queue show'\n\n`

const help_string_admin = `Teaching Assistants and Professors have additional commands that may be used:\n`
    + `**Queue:**\n`
    + `> *queue* - You can also use the 'next' parameter to get the next user in the queue\n`
    + `> Example: '${command_prefix}queue next'\n\n`
    + `**Channel user limits:**\n`
    + `> *unlimit* - Removes the user limit of the voice channel you are currently in\n`
    + `> *limit* - Sets the user limit to 4 of the voice channel you are currently in\n`
    + `> Example: '${command_prefix}unlimit' or '${command_prefix}limit'\n\n`

client.once('ready', () => {
    log_message('Bot started!');
    log_message(`Logs are ${(logs_enabled ? 'enabled' : 'disabled')}!`);
});

client.on('message', msg => {
    if (!msg.content.startsWith(command_prefix)) return;

    handle_command(msg);
});

client.on('voiceStateUpdate', (oldVoiceState, newVoiceState) => {
    let oldChannel = oldVoiceState.channel;
    let newChannel = newVoiceState.channel;

    if (oldChannel === null && newChannel !== null) {   // Testing only, for now...
        //bot_channel = newChannel;
        //newChannel.join()
        //    .catch(console.error);
        return;
    } else { // if (newChannel === null) {
        if (temp_channels.includes(oldChannel.id) && oldChannel.members.size < 1) {
            let old_name = oldChannel.name;
            let server = client.guilds.cache.get(server_id);

            temp_channels.splice(temp_channels.indexOf(oldChannel.id), 1);
            oldChannel.delete();
            /* Will get mixed up anyways if people leave lower rooms
            if (oldChannel.parent == server.channels.cache.find(cat => cat.name == lab_category)) {
                num_lab_channels--;
            } else if (oldChannel.parent == server.channels.cache.find(cat => cat.name == office_category)) {
                num_office_channels--;
            } else if (oldChannel.parent == server.channels.cache.find(cat => cat.name == work_category)) {
                num_work_channels--;
            }*/

            log_message(`${bot_name} deleted ${old_name}`);
        }
    }
});

client.login(bot_token);

function parse_message(msg) {
    const no_prefix = msg.content.slice(command_prefix.length);
    const tokens = no_prefix.match(/\w+[-]\w+|\w+|"[^"]+"/g);
    //const command = tokens[0]; // not needed yet
    //const arguments = tokens.slice(1); // not needed yet

    return tokens;
}

function handle_command(msg) {
    const parsed_message = parse_message(msg);
    const command = parsed_message[0].toLowerCase();
    const args = parsed_message.slice(1);

    if (msg.content.length <= command_prefix.length || (msg.channel.type === 'dm')) return;

    let ta_role = msg.member.roles.cache.find(role => role.name == 'Teaching Assistant');
    let prof_role = msg.member.roles.cache.find(role => role.name == 'Professor');

    let member = msg.guild.members.cache.find(member => member.id === msg.author.id);
    let channel = member.voice.channel;

    switch (command) {
        case 'help':
            if (!ta_role && !prof_role) {
                send_message(msg.channel, help_string);
            } else {
                send_message(msg.channel, help_string + help_string_admin);
            }

            log_message(`${msg.author.username} used the help command`);
            break;

        case 'send':
            if (args.length < 1) return;

            if (!ta_role && !prof_role) {
                log_message(msg.author.username + ' attempted to use send command');
                return;
            }
            send_message(msg.channel, args);
            log_message('Send command used by ' + msg.author.username);
            break;

        case 'unlimit':
            if (channel) {
                channel.setUserLimit(0)
                    .catch(console.err);
            }
            break;

        case 'limit':
            if (channel) {
                channel.setUserLimit(4)
                    .catch(console.err);
            }
            break;

        case 'shutdown':
            // Bot has to leave voice channel before shutting down or it will hang
            if (!ta_role && !prof_role) {
                log_message(msg.author.username + ' attempted to use send command');
                return;
            }

            if (bot_channel !== null) {
                bot_channel.leave();    
            }
            send_message(msg.channel, 'Goodbye world, I\'ll be back!')
                .then(() => client.destroy());
            log_message('Shutdown command used by ' + msg.author.username);
            break;

        case 'lab-channel':
            create_channel(msg, lab_category);
            log_message(`${msg.author.username} created a temporary lab channel`);
            break;

        case 'office-channel':
            create_channel(msg, office_category);
            log_message(`${msg.author.username} created a temporary office channel`);
            break;

        case 'work-channel':
            create_channel(msg, work_category);
            log_message(`${msg.author.username} created a temporary work channel`);
            break;
 
        case 'queue':
            if (args.length > 0) {
                switch (args[0].toLowerCase()) {
                    case 'join':
                        if (queue.has(msg.author)) {
                            msg.reply('you are already in the queue');
                            return;
                        }

                        queue.add(msg.author);
                        msg.reply('you have been added to the queue');
                        log_message(`${msg.author.username} has been added to the queue`);
                        break;

                    case 'leave':
                        if (!queue.has(msg.author)) {
                            msg.reply('you are not in the queue');
                            return;
                        }

                        queue.delete(msg.author);
                        msg.reply('you have been removed from the queue');
                        log_message(`${msg.author.username} has been removed from the queue`);
                        break;

                    case 'next':
                        let ta_role = msg.member.roles.cache.find(role => role.name == 'Teaching Assistant');
                        let prof_role = msg.member.roles.cache.find(role => role.name == 'Professor');

                        if (!ta_role && !prof_role) {
                            log_message(msg.author.username + ' attempted to use next command');
                            return;
                        }

                        if (queue.size > 0) {
                            let first_entry = queue.entries().next().value[0];
                            let first_member = msg.guild.members.cache.find(member => member.id === first_entry.id);
                            let fm_channel = first_member.voice.channel;
                            let fm_name = 'None (Please join a channel)';

                            if (fm_channel) {
                                fm_name = fm_channel.name;
                            }

                            //if (channel) {
                            //    member.setVoiceChannel(fm_channel);
                            //}

                            queue.delete(first_entry);
                            send_message(msg.channel, `<@${first_entry.id}> is the next student\nChannel: ${fm_name}`);
                            log_message(`Removing ${first_entry.username} from the queue`);
                        } else {
                            send_message(msg.channel, "Queue is empty!");
                        }
                        break;

                    case 'show':
                        if (queue.size > 0) {
                            let queue_str = '';
                            let entries = queue.entries();
                            let num_entries = 0;

                            for (const entry of entries) {
                                let member = msg.guild.member(entry[0]);
                                let nickname = member.displayName;

                                queue_str = queue_str + `${++num_entries}. ` + nickname
                                          + `${(nickname != entry[0].username) ? ' (' + entry[0].username + ')' : ''}` + '\n';
                            }

                            const embed = new Discord.MessageEmbed()
                                .setColor('#00ff55')
                                .setTitle('Queue')
                                .setDescription(queue_str);

                            if (queue.size > 0) {
                                msg.channel.send(embed);
                                log_message(`Displaying the queue for ${msg.author.username}`);
                            }
                        } else {
                            send_message(msg.channel, "Queue is empty!");
                        }
                        break;

                    default:
                        msg.reply('that\'s not a valid parameter!\n' + `\'${args}\'` + ' is not a valid parameter.');
                        log_message('Invalid command');
                }
            }
            break;

        default:
            msg.reply('that\'s not a real command!\n' + `\'${command}\'` + ' is not a valid command.');
            log_message('Invalid command');
    }
}

async function send_message(channel, msg) {
    const cleaned_message = String(msg).replace(/["]+/g, '').replace(/, |,+/g, ", ");

    return channel.send(cleaned_message)
        .catch(e => {
            log_message(e);
        });
}

function create_channel(msg, cata) {
    let server = msg.guild;
    let category = server.channels.cache.find(cat => cat.name == cata);
    let options = {
        type: 'voice',
        userLimit: 4,
        parent: category,
        reason: 'Created upon command'
    }

    switch (cata) {
        case lab_category:
            num_lab_channels++;
            server.channels.create(`Lab Room ${num_lab_channels}`, options)
                .then(add_channel)
                .catch(console.error);
            break;

        case office_category:
            num_office_channels++;
            server.channels.create(`Group Area ${num_office_channels}`, options)
                .then(add_channel)
                .catch(console.error);
            break;

        case work_category:
            num_work_channels++;
            server.channels.create(`Work Room ${num_work_channels}`, options)
                .then(add_channel)
                .catch(console.error);
            break;

    }
}

function add_channel(channel) {
    temp_channels.push(channel.id);
}

function log_message(msg) {
    if (!logs_enabled) return;

    console.log(timestamp() + msg);  // Change to file
}

function timestamp() {
    var current_date = new Date();
    var mm = `${current_date.getMonth() + 1}`;
    var dd = `${current_date.getDate()}`;
    var yyyy = `${current_date.getYear() + 1900}`;
    var hr = `${current_date.getHours()}`;
    var min = `${current_date.getMinutes()}`;
    var sec = `${current_date.getSeconds()}`;

    return formatted_date = `[${yyyy}-${(mm > 9 ? '' : '0')}${mm}-${(dd > 9 ? '' : '0')}${dd} `
        + `${(hr > 9 ? '' : '0')}${hr}:${(min > 9 ? '' : '0')}${min}:${(sec > 9 ? '' : '0')}${sec}] `;
}

function stack_trace() {
    var error = new Error();
    return error.stack;
}