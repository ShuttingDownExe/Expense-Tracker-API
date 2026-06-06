const assert = require('node:assert/strict')
const test = require('node:test')
const { expenseSchema } = require('../utils/validation')

test('expenseSchema accepts valid expense data', (t) => {
    const expense = {
        description: 'Coffee with team',
        amount: 12.5,
        date: '2026-06-06',
        vendor: 'Star Coffee',
        type: 'Debit',
    }

    const result = expenseSchema.safeParse(expense)

    assert.equal(result.success, true)
    assert.deepEqual(result.data, expense)
})

test('expenseSchema rejects missing description', (t) => {
    const expense = {
        amount: 12.5,
        date: '2026-06-06',
        vendor: 'Star Coffee',
        type: 'Debit',
    }

    const result = expenseSchema.safeParse(expense)

    assert.equal(result.success, false)
    assert.ok(result.error.issues.some((err) => err.path.join('.') === 'description'))
})

test('expenseSchema rejects non-positive amount', (t) => {
    const expense = {
        description: 'Office supplies',
        amount: 0,
        date: '2026-06-06',
        vendor: 'Stationery Store',
        type: 'Debit',
    }

    const result = expenseSchema.safeParse(expense)

    assert.equal(result.success, false)
    assert.ok(result.error.issues.some((err) => err.path.join('.') === 'amount'))
})

test('expenseSchema rejects invalid date format', (t) => {
    const expense = {
        description: 'Taxi fare',
        amount: 20,
        date: 'not-a-date',
        vendor: 'City Cabs',
        type: 'Debit',
    }

    const result = expenseSchema.safeParse(expense)

    assert.equal(result.success, false)
    assert.ok(result.error.issues.some((err) => err.path.join('.') === 'date'))
})

test('expenseSchema rejects invalid type values', (t) => {
    const expense = {
        description: 'Dinner',
        amount: 45,
        date: '2026-06-06',
        vendor: 'Local Bistro',
        type: 'Refund',
    }

    const result = expenseSchema.safeParse(expense)

    assert.equal(result.success, false)
    assert.ok(result.error.issues.some((err) => err.path.join('.') === 'type'))
})
