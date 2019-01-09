import Mocha from 'mocha'

export const Feature = (what: string, how: () => void) => describe('Feature: ' + what, how)
export const Scenario = (what: string, how: () => void) => describe('Scenario: ' + what, how)
export const Given = (what: string, how: (done: Mocha.Done) => void) => it('Given ' + what, how)
export const When = (what: string, how: (done: Mocha.Done) => void) => it('When ' + what, how)
export const Then = (what: string, how: (done: Mocha.Done) => void) => it('Then ' + what, how)
export const And = (what: string, how: (done: Mocha.Done) => void) => it('And ' + what, how)
export const Before: (callback: (this: Mocha.Context, done: Mocha.Done) => any) => void = before
export const After: (callback: (this: Mocha.Context, done: Mocha.Done) => any) => void = after

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiString from 'chai-string'
chai.use(chaiAsPromised)
chai.use(chaiString)
chai.should()

declare let global: any
global.After = after
global.Before = before
