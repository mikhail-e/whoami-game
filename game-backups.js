// Who am I? Game - Disk backups of the rooms
//
// The keep-alive loop in server.js saves every room with players online to
// <gamesDir>/<CODE>.json; a room that is missing from memory (after a server
// restart) comes back from its file. No Express or Socket.IO here, so the
// tests use the real functions with a folder of their own.
const fs = require('fs');
const path = require('path');
const { isValidRoomCode, serializeGame } = require('./game-logic');

function createGameBackups(gamesDir) {
    fs.mkdirSync(gamesDir, { recursive: true });

    // The file of a room. Only a real room code names a file: anything else
    // (a link like /game/..%2Fsecret) is never turned into a path
    function fileOf(roomCode) {
        return isValidRoomCode(roomCode) ? path.join(gamesDir, `${roomCode}.json`) : null;
    }

    return {
        // Write the room's backup
        save(game) {
            const file = fileOf(game.id);
            if (!file) return;
            const backup = { ...serializeGame(game, { withSecrets: true }), lastKeepAlive: new Date().toISOString() };
            try {
                fs.writeFileSync(file, JSON.stringify(backup, null, 2));
            } catch (error) {
                console.error(`❌ Failed to save game ${game.id} to disk:`, error);
            }
        },

        // The saved data of a room (still unchecked: restoreGame() checks it),
        // or null when there is no readable backup
        load(roomCode) {
            const file = fileOf(roomCode);
            if (!file || !fs.existsSync(file)) return null;
            try {
                return JSON.parse(fs.readFileSync(file, 'utf8'));
            } catch (error) {
                console.error(`❌ Failed to read the backup of game ${roomCode}:`, error);
                return null;
            }
        },

        // Remove the room's backup (no file is not an error)
        remove(roomCode) {
            const file = fileOf(roomCode);
            if (!file) return;
            try {
                fs.rmSync(file, { force: true });
            } catch (error) {
                console.error(`❌ Failed to remove the backup of game ${roomCode}:`, error);
            }
        },

        // Remove backups not written for maxAgeMs, except those of rooms still
        // in memory (games). Other files in the folder are left alone.
        // Returns the room codes whose backups were removed
        removeOld(games, maxAgeMs) {
            const removed = [];
            const oldest = Date.now() - maxAgeMs;
            for (const file of fs.readdirSync(gamesDir)) {
                const roomCode = path.basename(file, '.json');
                if (!file.endsWith('.json') || games.has(roomCode)) continue;
                const filePath = path.join(gamesDir, file);
                if (fs.statSync(filePath).mtime.getTime() < oldest) {
                    fs.rmSync(filePath, { force: true });
                    removed.push(roomCode);
                }
            }
            return removed;
        }
    };
}

module.exports = { createGameBackups };
