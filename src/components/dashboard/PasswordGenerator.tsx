import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { generatePassword, calculatePasswordStrength } from '@/lib/supabase'
import { Copy, RefreshCw, Key } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export const PasswordGenerator = () => {
  const [password, setPassword] = useState('')
  const [length, setLength] = useState([16])
  const [includeNumbers, setIncludeNumbers] = useState(true)
  const [includeSymbols, setIncludeSymbols] = useState(true)
  const [includeUppercase, setIncludeUppercase] = useState(true)
  const [includeLowercase, setIncludeLowercase] = useState(true)
  const { toast } = useToast()

  const handleGenerate = () => {
    const newPassword = generatePassword(
      length[0],
      includeNumbers,
      includeSymbols,
      includeUppercase,
      includeLowercase
    )
    setPassword(newPassword)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(password)
      toast({
        title: "Copied",
        description: "Password copied to clipboard",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy password",
        variant: "destructive",
      })
    }
  }

  const strength = password ? calculatePasswordStrength(password) : { score: 0, feedback: [] }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Password Generator</h2>
        <p className="text-muted-foreground">Generate strong, secure passwords</p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5" />
            <span>Generate Password</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="generated-password">Generated Password</Label>
            <div className="flex space-x-2">
              <Input
                id="generated-password"
                value={password}
                readOnly
                className="font-mono text-lg"
                placeholder="Click generate to create a password"
              />
              <Button variant="outline" onClick={copyToClipboard} disabled={!password}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Password Length: {length[0]}</Label>
              <Slider
                value={length}
                onValueChange={setLength}
                max={50}
                min={8}
                step={1}
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="uppercase"
                  checked={includeUppercase}
                  onChange={(e) => setIncludeUppercase(e.target.checked)}
                />
                <Label htmlFor="uppercase">Uppercase (A-Z)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="lowercase"
                  checked={includeLowercase}
                  onChange={(e) => setIncludeLowercase(e.target.checked)}
                />
                <Label htmlFor="lowercase">Lowercase (a-z)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="numbers"
                  checked={includeNumbers}
                  onChange={(e) => setIncludeNumbers(e.target.checked)}
                />
                <Label htmlFor="numbers">Numbers (0-9)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="symbols"
                  checked={includeSymbols}
                  onChange={(e) => setIncludeSymbols(e.target.checked)}
                />
                <Label htmlFor="symbols">Symbols (!@#$)</Label>
              </div>
            </div>
          </div>

          <Button variant="security" onClick={handleGenerate} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Generate Password
          </Button>

          {password && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Password Strength</span>
                <span className={
                  strength.score >= 80 ? 'text-accent' :
                  strength.score >= 60 ? 'text-yellow-500' :
                  'text-destructive'
                }>
                  {strength.score >= 80 ? 'Strong' :
                   strength.score >= 60 ? 'Good' :
                   strength.score >= 40 ? 'Fair' : 'Weak'}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    strength.score >= 80 ? 'bg-accent' :
                    strength.score >= 60 ? 'bg-yellow-500' :
                    'bg-destructive'
                  }`}
                  style={{ width: `${strength.score}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}