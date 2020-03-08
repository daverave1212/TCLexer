
let fs = require('fs')

let keywordList = require('./keywords')
let operatorList = require('./operators')

function isWhitespace(char) { return char.trim().length == 0 }
function isLetter(char) { return 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM'.includes(char) }
function isDigit(char) { return '1234567890'.includes(char) }

let operatorCharacters = []
for(let operator of operatorList){
    for(let letter of operator){
        if(!operatorCharacters.includes(letter)){
            operatorCharacters.push(letter)
        }
    }
}

function isOperatorCharacter(char) { return operatorCharacters.includes(char) }

function charType(char){    // Can be optimized with a map
    if(isWhitespace(char))  return 'whitespace'
    if(isLetter(char))      return 'letter'
    if(isDigit(char))       return 'digit'
    if(char == '.')         return '.'
    if(isOperatorCharacter(char))   return 'operator'
    console.log('Error: Could not find char type for character: ' + char)
    return '???'
}

let keywords = {}
let operators = {}

for(let keyword of keywordList){
    let letterLink = keywords
    for(let letter of keyword){
        if(letterLink[letter] == null){
            letterLink[letter] = {}
        }
        letterLink = letterLink[letter]
    }
    letterLink.endsHere = true
}


for(let operator of operatorList){
    let letterLink = operators
    for(let letter of operator){
        if(letterLink[letter] == null) {
            letterLink[letter] = {}
        }
        letterLink = letterLink[letter]
    }
    letterLink.endsHere = true
}

class Lexer {
    constructor(text){
        this.text = text
        this.tokens = []
        this.currentState = this.readingSpaces
        this.currentString = ''

        this.currentNumberType = 'int'  // Used to remember if the number was float or int; it's int by default if we can't find a "."
    }

    exit(char){ console.log('Error reading character ' + char + ' after ' + this.currentString) }
    error(message) { console.log('Error: ' + message) }

    lex(){
        for(let letter of this.text){
            this.currentState = this.currentState(letter)
        }
        if(this.currentString.length > 0 && this.currentState != this.readingSpaces)
            this.tokens.push(this.currentString)
        return this.tokens
    }

    readingSpaces(char){
        switch(charType(char)){
            case 'whitespace': return this.readingSpaces
            case 'letter':
                return this.setupAndReturnLetterState(char)
            case 'operator':
                return this.setupAndReturnOperatorState(char)
            case 'digit':
                this.currentString = char
                return this.readingNumber
            default:
                this.exit(char)
        }
    }

    readingOperator(char){

        let pushOrExit = _ => {
            if(this.currentWordLink.endsHere) this.tokens.push({ value : this.currentString, type : 'operator' })
            else this.error(`${this.currentString} is not a valid operator`)
        }

        switch(charType(char)){
            case 'operator':
                if(this.currentWordLink[char] == null){
                    if(this.currentWordLink.endsHere){
                        this.tokens.push({ value : this.currentString, type : 'operator' })
                        this.currentWordLink = operators[char]
                        if(this.currentWordLink == null){
                            this.error(`Unknown operator ${char}`)
                        } else {
                            this.currentString = char
                            return this.readingOperator
                        }
                    } else {
                        this.error(`Non-terminal state at char ${char} with word ${this.currentString}`)
                    }
                } else {
                    this.currentWordLink = this.currentWordLink[char]
                    return this.readingOperator
                }
            case 'whitespace':
                pushOrExit()
                return this.readingSpaces
            case 'letter':
                pushOrExit()
                return this.setupAndReturnLetterState(char)
            case 'digit':
                console.log(`Yes found ${char}`)
                pushOrExit()
                this.currentString = char
                return this.readingNumber
            default:
                this.exit(char)

        }
    }


    readingNumber(char){
        let pushAndClear = () => {
            this.tokens.push({ value : this.currentString, type : this.currentNumberType })
            this.currentNumberType = 'int'  // Clear number type for later
        }
        switch(charType(char)){
            case 'whitespace':
                pushAndClear()
                return this.readingSpaces
            case 'digit':
                this.currentString += char
                return this.readingNumber
            case '.':
                if(this.currentNumberType == 'int') {
                    this.currentNumberType = 'float'
                    this.currentString += char
                    return this.expectingDigit
                } else    // If it's float or on an unexpected error
                    this.error(`When reading ".", got unexpected number type ${this.currentNumberType} with ${this.currentString}`)
            case 'operator':
                pushAndClear()
                return this.setupAndReturnOperatorState(char)
            default:
                this.exit(char)
        }
    }

    expectingDigit(char){
        switch(charType(char)){
            case 'digit':
                this.currentString += char
                return this.readingNumber
            default:
                this.error(`Invalid character ${char} after "." in ${this.currentString}`)
        }
    }


    readingNormalWord(char){
        switch(charType(char)){
            case 'whitespace':
                this.tokens.push({ value : this.currentString, type : 'word' })
                return this.readingSpaces
            case 'letter':
                this.currentString += char
                return this.readingNormalWord
            case 'operator':
                this.tokens.push({ value : this.currentString, type : 'word' })
                return this.setupAndReturnOperatorState(char)
            default:
                this.exit(char)
        }

    }

    readingUnknownWord(char){
        let tokenType = 'word'
        switch(charType(char)){
            case 'whitespace':
                if(this.currentWordLink.endsHere)
                    tokenType = 'keyword'
                this.tokens.push({ value : this.currentString, type : tokenType })
                return this.readingSpaces
            case 'letter':
                this.currentString += char
                this.currentWordLink = this.currentWordLink[char]
                if(this.currentWordLink == null) return this.readingNormalWord
                else return this.readingUnknownWord
            case 'operator':
                if(this.currentWordLink.endsHere)
                    tokenType = 'keyword'
                this.tokens.push({ value : this.currentString, type : tokenType })
                return this.setupAndReturnOperatorState(char)
            default:
                this.exit(char)
        }
    }

    setupAndReturnOperatorState(char){
        this.currentString = char
        this.currentWordLink = operators[char]
        if(this.currentWordLink == null) this.error(`No operator starts with ${char}`)
        else return this.readingOperator
    }
    setupAndReturnLetterState(char){
        this.currentString = char
        this.currentWordLink = keywords[char]
        if(this.currentWordLink == null) return this.readingNormalWord
        else return this.readingUnknownWord
    }

}






let code = fs.readFileSync('code.code', 'utf8')

let lexer = new Lexer(code)
console.log(lexer.lex())
