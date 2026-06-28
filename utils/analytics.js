const getLocalDateString = (timezone, offsetDays = 0) => {
    const d = new Date()
    d.setDate(d.getDate() - offsetDays)

    try {
        return d.toLocaleDateString('en-CA', { timeZone: timezone })
    } catch (error) {
        console.warn(`Invalid timezone requested: ${timezone}. Falling back to UTC.`)
        return d.toLocaleDateString('en-CA', { timeZone: 'UTC' })
    }
}

const sumExpenses = (expenses) => {
    let total = 0
    Object.values(expenses || {}).forEach((expense) => {
        total += Number(expense.amount)
    })
    return total
}

const buildCurrentWeekBlueprint = (timezone) => {
    const todayStr = getLocalDateString(timezone, 0)
    const currentDayOfTheWeek = new Date(todayStr).getDay()

    const blueprint = {}
    const dateMap = {}

    for (let i = 0 ; i <= currentDayOfTheWeek; i++) {
        const offset = currentDayOfTheWeek - i
        const dateStr = getLocalDateString(timezone, offset)
        dateMap[dateStr] = i
        blueprint[i] = 0
    }

    const startDate = getLocalDateString(timezone, currentDayOfTheWeek)
    return {blueprint, dateMap, startDate}
}

const buildCurrentMonthBlueprint = (timezone) => {
    // Derive "today" via the guarded helper (falls back to UTC for a bad tz),
    // then read the day-of-month off the explicitly-UTC-parsed ISO string so
    // there's no server-timezone drift. Mirrors buildCurrentWeekBlueprint.
    const todayStr = getLocalDateString(timezone, 0)
    const currentDayOfTheMonth = new Date(`${todayStr}T00:00:00Z`).getUTCDate()

    const blueprint = {}
    const dateMap = {}

    // Map the 1st of the month through today onto 1-based day indices.
    for (let i = 1; i <= currentDayOfTheMonth; i++) {
        const offset = currentDayOfTheMonth - i
        const dateStr = getLocalDateString(timezone, offset)

        dateMap[dateStr] = i
        blueprint[i] = 0
    }

    const startDate = getLocalDateString(timezone, currentDayOfTheMonth - 1)

    return { blueprint, dateMap, startDate }
}
const aggregateExpensesByMap = (expenses, blueprint, dateMap) => {
    const result = {...blueprint}
    Object.values(expenses || {}).forEach(expense => {
        const expDate = expense.date
        const key = dateMap[expDate]

        if (key !== undefined && result[key] !== undefined){
            result[key] += (Number(expense.amount)||0)
        }
    })

    return result
}

module.exports = { getLocalDateString, sumExpenses, buildCurrentWeekBlueprint, buildCurrentMonthBlueprint, aggregateExpensesByMap }
