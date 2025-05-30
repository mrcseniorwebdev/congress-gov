const authRouter = require('express').Router()
const passport = require('passport')

const localhost = process.env.NODE_ENV === 'dev' ? 'http://localhost:3000' : ''


authRouter.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}))

authRouter.get('/google/redirect', passport.authenticate('google', { failureRedirect: `${localhost}/searchbiasreport/login` }), (req, res) => {
    // res.send(req.user);
    console.log('oh hello there..')
    res.redirect(`${localhost}/searchbiasreport/dashboard/main`)
})

authRouter.get('/logout', (req, res) => {
    req.logout()
    res.redirect(`${localhost}/searchbiasreport/login`)
    // try {
    //     res.status(200)
    // }
    // catch (err) {
    //     console.error(err)
    //     res.status(400)
    // }
})

module.exports = authRouter
