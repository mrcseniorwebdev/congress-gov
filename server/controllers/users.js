const userRouter = require('express').Router()
const pool = require('../utils/db')
const { authCheck } = require('../utils/authMiddleware')



userRouter.use(authCheck)

/*
 * return all
 */
userRouter.get('/', async (req, res) => {
    let users
    let conn
    try {
        conn = await pool.getConnection()
        const rows = await conn.query('SELECT uid, email FROM users')
        users = rows
    }
    catch (err) {
        console.error(err)
    }
    finally {
        if (conn) {
            console.log('ending db conn...')
            await conn.end()
        }
    }
    console.log(users)
    users ? res.json(users) : res.status(400).json({ error: 'get error' })
    // res.send('<h1>Herro</h1>')
})

/*
 * Post method for adding a single user
 */
userRouter.post('/', async (req, res) => {
    //grab the form data
    const body = req.body
    //deny if no email
    const email = body.email
    if (!email) {
        res
            .status(400)
            .send('No Email???')
        return
    }


    //create the new ad using the Users Schema
    let conn
    let sendErr
    let resp
    try {
        conn = await pool.getConnection()
        resp = await conn.query('INSERT INTO users (email) VALUES (?)',
            [
                email
            ])
    }
    catch (err) {
        console.error(err)
        sendErr = err
    }
    finally {
        if (conn) {
            console.log('ending db conn...')
            await conn.end()
        }
    }

    !sendErr && resp ? res.status(201).json(resp) : res.status(400).json({ error: sendErr })
})


/*
 * delete user by uid
 */
userRouter.delete('/:id', async (req, res) => {
    const id = req.params.id
    let conn
    let error = false
    try {
        conn = await pool.getConnection()
        await conn.query(`DELETE FROM users WHERE uid = '${id}'`)
    }
    catch (err) {
        console.error(err)
        error = true
    }
    finally {
        if (conn) {
            console.log('ending db conn...')
            await conn.end()
        }
    }
    error
        ? res
            .status(400)
            .json({ error: 'deletion error' })
        : res
            .status(204)
            .send('deleted')
})



module.exports = userRouter
