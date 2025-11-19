"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Plus } from "lucide-react"

type IOUType = "beer" | "coffee" | "ride" | "meal" | "snack" | "drink" | "favor"

interface IOU {
  id: string
  emoji: string
  type: IOUType
  quantity: number
  direction: "owes-you" | "you-owe"
}

interface Ledger {
  id: string
  name: string
  ious: IOU[]
}

const mockLedgers: Ledger[] = [
  {
    id: "1",
    name: "darsh",
    ious: [{ id: "1", emoji: "🥤", type: "drink", quantity: 1, direction: "owes-you" }],
  },
  {
    id: "2",
    name: "tushar",
    ious: [
      { id: "2", emoji: "☕", type: "coffee", quantity: 1, direction: "owes-you" },
      { id: "3", emoji: "🚗", type: "ride", quantity: 1, direction: "you-owe" },
    ],
  },
  {
    id: "3",
    name: "alex",
    ious: [
      { id: "4", emoji: "🍺", type: "beer", quantity: 2, direction: "owes-you" },
      { id: "5", emoji: "🍕", type: "meal", quantity: 1, direction: "owes-you" },
    ],
  },
  {
    id: "4",
    name: "sarah",
    ious: [{ id: "6", emoji: "🚗", type: "ride", quantity: 3, direction: "you-owe" }],
  },
]

export default function IOULedgerPage() {
  const [activeTab, setActiveTab] = useState("all")

  const filterLedgers = (ledgers: Ledger[]) => {
    if (activeTab === "all") return ledgers

    return ledgers.filter((ledger) => {
      if (activeTab === "owe-me") {
        return ledger.ious.some((iou) => iou.direction === "owes-you")
      }
      if (activeTab === "i-owe") {
        return ledger.ious.some((iou) => iou.direction === "you-owe")
      }
      return true
    })
  }

  const getBalanceSummary = (ious: IOU[]) => {
    const owesYou = ious.filter((iou) => iou.direction === "owes-you")
    const youOwe = ious.filter((iou) => iou.direction === "you-owe")

    return { owesYou, youOwe }
  }

  const filteredLedgers = filterLedgers(mockLedgers)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="mb-2 text-5xl font-bold tracking-tight text-primary sm:text-6xl">IOU</h1>
          <p className="text-balance text-sm text-muted-foreground sm:text-base">
            Keep track of what your friends owe you (in beers, rides, and more!)
          </p>
        </header>

        {/* Title and New Ledger Button */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Your Ledgers</h2>
          <Button className="rounded-full bg-gradient-to-r from-orange-400 via-pink-400 to-purple-500 px-6 text-white shadow-lg hover:shadow-xl transition-shadow">
            <Plus className="mr-2 h-4 w-4" />
            New Ledger
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-3 bg-card">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="owe-me">Owe Me</TabsTrigger>
            <TabsTrigger value="i-owe">I Owe</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6 space-y-4">
            {filteredLedgers.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No ledgers found</p>
              </Card>
            ) : (
              filteredLedgers.map((ledger) => {
                const { owesYou, youOwe } = getBalanceSummary(ledger.ious)

                return (
                  <Card key={ledger.id} className="cursor-pointer p-6 transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="mb-2 text-xl font-semibold text-foreground">{ledger.name}</h3>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {owesYou.length > 0 && (
                            <p>
                              {ledger.name} owes you{" "}
                              {owesYou.map((iou, idx) => (
                                <span key={iou.id}>
                                  {iou.emoji} ×{iou.quantity}
                                  {idx < owesYou.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </p>
                          )}
                          {youOwe.length > 0 && (
                            <p>
                              You owe {ledger.name}{" "}
                              {youOwe.map((iou, idx) => (
                                <span key={iou.id}>
                                  {iou.emoji} ×{iou.quantity}
                                  {idx < youOwe.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Balance Badges */}
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {owesYou.map((iou) => (
                          <Badge
                            key={iou.id}
                            variant="secondary"
                            className="flex items-center gap-1 bg-cyan-50 px-3 py-1.5 text-cyan-600"
                          >
                            <span className="text-base">{iou.emoji}</span>
                            <span className="font-semibold">+{iou.quantity}</span>
                          </Badge>
                        ))}
                        {youOwe.map((iou) => (
                          <Badge
                            key={iou.id}
                            variant="secondary"
                            className="flex items-center gap-1 bg-stone-100 px-3 py-1.5 text-stone-700"
                          >
                            <span className="text-base">{iou.emoji}</span>
                            <span className="font-semibold">-{iou.quantity}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
