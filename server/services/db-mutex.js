// node-sqlite3 uses a single connection for the whole app. Two concurrent
// requests that each try to run their own BEGIN...COMMIT block on that
// connection can have their statements interleaved (the driver does not
// serialize by default), which would corrupt or half-apply a transaction.
// This tiny queue makes sure only one transactional operation runs at a
// time - acceptable for a single-user local desktop app, and much simpler
// (and safer) than trying to coordinate savepoints across requests.

let chain = Promise.resolve();

function withDbLock(fn) {
    const result = chain.then(() => fn());
    // keep the queue moving even if this task fails
    chain = result.then(() => undefined, () => undefined);
    return result;
}

module.exports = { withDbLock };
